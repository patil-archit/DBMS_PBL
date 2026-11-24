"""
Discovery features built on the existing schema (no new tables):
catalogue browsing with paging, the genre index, a random "surprise me" book,
book of the day, catalogue statistics and per-reader reading stats.
Reading stats read diary_entry under row-level security, so a private diary
returns nothing to other readers.
"""
import datetime

from fastapi import HTTPException

from app.database import db
from app.services.book_service import BOOK_CARD
from app.services.user_service import _user_by_username

CARD = BOOK_CARD + ", bs.pub_year, bs.page_count, bs.ratings_count, bs.description"

SORTS = {
    "popular": "bs.ratings_count DESC, bs.avg_rating DESC",
    "rating": "(bs.ratings_count >= 20) DESC, bs.avg_rating DESC, bs.ratings_count DESC",
    "newest": "bs.pub_year DESC NULLS LAST, bs.ratings_count DESC",
    "oldest": "bs.pub_year ASC NULLS LAST, bs.ratings_count DESC",
    "shortest": "bs.page_count ASC NULLS LAST, bs.ratings_count DESC",
    "longest": "bs.page_count DESC NULLS LAST, bs.ratings_count DESC",
    "title": "bs.title",
}


def browse(genre=None, sort="popular", decade=None, max_pages=None, min_rating=None, offset=0, limit=30):
    """One page of the catalogue for infinite scrolling, plus the total match count."""
    where, params = ["bs.cover_url IS NOT NULL"], {}
    if genre:
        where.append("%(genre)s = ANY(bs.genres)")
        params["genre"] = genre
    if decade is not None:
        where.append("bs.pub_year >= %(d0)s AND bs.pub_year < %(d0)s + 10")
        params["d0"] = decade
    if max_pages:
        where.append("bs.page_count <= %(pages)s")
        params["pages"] = max_pages
    if min_rating is not None:
        where.append("bs.avg_rating >= %(rating)s")
        params["rating"] = min_rating
    sql_where = " AND ".join(where)
    order = SORTS.get(sort, SORTS["popular"])
    with db.cursor() as cur:
        cur.execute(f"SELECT count(*) AS n FROM book_summary bs WHERE {sql_where}", params)
        total = cur.fetchone()["n"]
        cur.execute(
            f"""SELECT {CARD} FROM book_summary bs WHERE {sql_where}
                ORDER BY {order}, bs.book_id LIMIT %(limit)s OFFSET %(offset)s""",
            {**params, "limit": limit, "offset": offset},
        )
        books = cur.fetchall()
    return {"total": total, "offset": offset, "books": books}


def genre_index():
    """Every genre with its book count, average rating and three of its best-known covers."""
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT g.name, count(*) AS book_count, round(avg(b.avg_rating), 2) AS avg_rating,
                   (array_agg(b.cover_url ORDER BY b.ratings_count DESC)
                        FILTER (WHERE b.cover_url LIKE '%%/b/id/%%'))[1:3] AS covers
            FROM genre g
            JOIN book_genre bg USING (genre_id)
            JOIN book b USING (book_id)
            GROUP BY g.genre_id
            HAVING count(*) >= 3
            ORDER BY book_count DESC
            """
        )
        return cur.fetchall()


def random_book(genre=None):
    """A random well-liked book (optionally in a genre)."""
    with db.cursor() as cur:
        cur.execute(
            f"""SELECT {CARD} FROM book_summary bs
                WHERE bs.cover_url IS NOT NULL AND bs.avg_rating >= 3.5 AND bs.ratings_count >= 5
                  AND (%(g)s::text IS NULL OR %(g)s = ANY(bs.genres))
                ORDER BY random() LIMIT 1""",
            {"g": genre},
        )
        book = cur.fetchone()
    if not book:
        raise HTTPException(404, "No book found")
    return book


def book_of_the_day():
    """The same book for everyone all day: picks by today's date among popular, well-rated books."""
    day = datetime.date.today().toordinal()
    with db.cursor() as cur:
        cur.execute(
            """SELECT count(*) AS n FROM book_summary bs
               WHERE bs.cover_url IS NOT NULL AND bs.avg_rating >= 4 AND bs.ratings_count >= 50
                 AND bs.description IS NOT NULL"""
        )
        n = cur.fetchone()["n"]
        if not n:
            return None
        cur.execute(
            f"""SELECT {CARD} FROM book_summary bs
                WHERE bs.cover_url IS NOT NULL AND bs.avg_rating >= 4 AND bs.ratings_count >= 50
                  AND bs.description IS NOT NULL
                ORDER BY bs.book_id OFFSET %s LIMIT 1""",
            ((day * 7919) % n,),
        )
        return cur.fetchone()


def catalogue_stats():
    """Headline numbers and the catalogue timeline (books per decade)."""
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT (SELECT count(*) FROM book)        AS books,
                   (SELECT count(*) FROM author)      AS authors,
                   (SELECT count(*) FROM genre)       AS genres,
                   (SELECT count(*) FROM publisher)   AS publishers,
                   (SELECT count(*) FROM users)       AS readers,
                   (SELECT count(*) FROM diary_entry) AS diary_entries,
                   (SELECT count(*) FROM list)        AS lists,
                   (SELECT coalesce(sum(page_count), 0) FROM book) AS pages,
                   (SELECT min(pub_year) FROM book WHERE pub_year > 0) AS oldest_year
            """
        )
        stats = cur.fetchone()
        cur.execute(
            """SELECT (pub_year / 10) * 10 AS decade, count(*) AS books
               FROM book WHERE pub_year >= 1800 GROUP BY 1 ORDER BY 1"""
        )
        stats["decades"] = cur.fetchall()
    return stats


def reading_stats(username, year=None):
    """
    A reader's year (or all-time) in books: totals, pages, rating spread,
    month-by-month, top genres and authors, longest/shortest and highest-rated books.
    """
    with db.cursor() as cur:
        user = _user_by_username(cur, username)
        if not user:
            raise HTTPException(404, "User not found")
        uid = user["user_id"]
        f = {"u": uid, "y": year}
        yr = "AND (%(y)s::int IS NULL OR EXTRACT(YEAR FROM coalesce(d.date_read, d.created_at::date)) = %(y)s)"

        cur.execute(
            f"""
            SELECT count(*) AS entries, count(DISTINCT d.book_id) AS books,
                   coalesce(sum(b.page_count), 0) AS pages,
                   round(avg(d.rating), 2) AS avg_rating,
                   count(*) FILTER (WHERE d.review_text IS NOT NULL AND d.review_text <> '') AS reviews,
                   count(*) FILTER (WHERE d.is_liked) AS liked,
                   count(*) - count(DISTINCT d.book_id) AS rereads
            FROM diary_entry d JOIN book b USING (book_id)
            WHERE d.user_id = %(u)s {yr}
            """,
            f,
        )
        totals = cur.fetchone()

        cur.execute(
            f"""SELECT d.rating, count(*) AS n FROM diary_entry d
                WHERE d.user_id = %(u)s AND d.rating IS NOT NULL {yr}
                GROUP BY d.rating ORDER BY d.rating""",
            f,
        )
        ratings = cur.fetchall()

        cur.execute(
            f"""SELECT EXTRACT(MONTH FROM coalesce(d.date_read, d.created_at::date))::int AS month,
                       count(*) AS books, coalesce(sum(b.page_count), 0) AS pages
                FROM diary_entry d JOIN book b USING (book_id)
                WHERE d.user_id = %(u)s {yr} GROUP BY 1 ORDER BY 1""",
            f,
        )
        months = cur.fetchall()

        cur.execute(
            f"""SELECT g.name, count(*) AS books FROM diary_entry d
                JOIN book_genre bg USING (book_id) JOIN genre g USING (genre_id)
                WHERE d.user_id = %(u)s {yr}
                GROUP BY g.name ORDER BY books DESC, g.name LIMIT 8""",
            f,
        )
        genres = cur.fetchall()

        cur.execute(
            f"""SELECT a.name, a.photo_url, count(*) AS books FROM diary_entry d
                JOIN book_author ba USING (book_id) JOIN author a USING (author_id)
                WHERE d.user_id = %(u)s {yr}
                GROUP BY a.author_id ORDER BY books DESC, a.name LIMIT 5""",
            f,
        )
        authors = cur.fetchall()

        def one(order, extra=""):
            cur.execute(
                f"""SELECT {CARD}, d.rating AS my_rating FROM diary_entry d
                    JOIN book_summary bs ON bs.book_id = d.book_id
                    WHERE d.user_id = %(u)s {yr} {extra}
                    ORDER BY {order} LIMIT 1""",
                f,
            )
            return cur.fetchone()

        highlights = {
            "longest": one("bs.page_count DESC NULLS LAST", "AND bs.page_count IS NOT NULL"),
            "shortest": one("bs.page_count ASC NULLS LAST", "AND bs.page_count IS NOT NULL"),
            "favourite": one("d.rating DESC NULLS LAST, d.is_liked DESC, bs.avg_rating DESC", "AND d.rating IS NOT NULL"),
            "oldest": one("bs.pub_year ASC NULLS LAST", "AND bs.pub_year IS NOT NULL"),
            "hidden_gem": one("bs.ratings_count ASC, d.rating DESC NULLS LAST", "AND d.rating >= 4"),
        }

        cur.execute(
            """SELECT DISTINCT EXTRACT(YEAR FROM coalesce(date_read, created_at::date))::int AS y
               FROM diary_entry WHERE user_id = %s ORDER BY 1 DESC""",
            (uid,),
        )
        years = [r["y"] for r in cur.fetchall()]

        # How this reader's average rating compares with the books' community average
        cur.execute(
            f"""SELECT round(avg(d.rating - b.avg_rating), 2) AS vs_crowd
                FROM diary_entry d JOIN book b USING (book_id)
                WHERE d.user_id = %(u)s AND d.rating IS NOT NULL AND b.ratings_count > 0 {yr}""",
            f,
        )
        vs_crowd = cur.fetchone()["vs_crowd"]

    return {
        "username": user["username"], "year": year, "years": years, "totals": totals,
        "ratings": ratings, "months": months, "genres": genres, "authors": authors,
        "highlights": highlights, "vs_crowd": vs_crowd,
    }


def featured_authors(limit=14):
    """Authors with a portrait, most-read first (for the home page strip)."""
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT a.name, a.photo_url, a.bio, count(*) AS books, sum(bs.ratings_count) AS ratings,
                   round(avg(bs.avg_rating)::numeric, 2) AS avg_rating
            FROM author a
            JOIN book_author ba ON ba.author_id = a.author_id
            JOIN book_summary bs ON bs.book_id = ba.book_id
            WHERE a.photo_url IS NOT NULL AND length(a.bio) > 60
            GROUP BY a.author_id
            HAVING count(*) BETWEEN 2 AND 120
            ORDER BY sum(bs.ratings_count) DESC NULLS LAST
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()


def journal(limit=6):
    """Latest written reviews. Runs under row-level security, so private diaries never appear."""
    with db.cursor() as cur:
        cur.execute(
            f"""
            SELECT d.entry_id, d.rating, d.review_text, d.created_at, u.username, {CARD}
            FROM diary_entry d
            JOIN users u ON u.user_id = d.user_id
            JOIN book_summary bs ON bs.book_id = d.book_id
            WHERE d.review_text IS NOT NULL AND length(d.review_text) > 20
            ORDER BY d.created_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        return cur.fetchall()
