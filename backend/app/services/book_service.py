"""
Catalogue: search, book pages, author pages, trending and recommendations.
All queries are parameterised SQL against PostgreSQL.
"""
import glob
import os
import re

from app import graph, mongo
from app.database import db

# Columns returned for a book card
BOOK_CARD = """
    bs.book_id,
    bs.title,
    bs.subtitle,
    bs.cover_url  AS thumbnail,
    bs.avg_rating AS average_rating,
    bs.authors,
    bs.genres     AS categories
"""

# Minimum trigram word-similarity for a search hit (0..1)
SEARCH_THRESHOLD = 0.45


def get_actual_image_url(author_name: str, photo_url: str = None):
    """
    Author photo: a local image in frontend/public/authors/ named after the
    author (any extension) if there is one, otherwise author.photo_url.
    """
    safe_name = re.sub(r"[^a-z0-9\s]", "", author_name.lower())
    safe_name = "_".join(safe_name.split())
    public_authors_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
        "frontend", "public", "authors",
    )
    matching_files = glob.glob(os.path.join(public_authors_dir, f"{safe_name}.*"))
    if matching_files:
        ext = os.path.splitext(matching_files[0])[1]
        return f"/authors/{safe_name}{ext}"
    return photo_url


def _with_images(authors):
    for a in authors:
        a["image_url"] = get_actual_image_url(a["name"], a.pop("photo_url", None))
    return authors


def books_by_ids(ids):
    """Book cards for the given ids, in the same order."""
    if not ids:
        return []
    with db.cursor() as cur:
        cur.execute(f"SELECT {BOOK_CARD} FROM book_summary bs WHERE bs.book_id = ANY(%s)", (list(ids),))
        by_id = {r["book_id"]: r for r in cur.fetchall()}
    return [by_id[i] for i in ids if i in by_id]


# =====================================================================
# SEARCH
# =====================================================================

def search_all(query: str, viewer=None, genre=None, language=None, min_rating=None):
    """
    Spelling-tolerant search over books, authors and genres using pg_trgm
    word similarity. Books match on title, subtitle, author, genre or ISBN,
    and can be filtered by genre, language and minimum rating.
    With an empty query and filters, returns the best-rated matching books.
    """
    q = " ".join((query or "").lower().split())
    filters, params = [], {"q": q, "t": SEARCH_THRESHOLD, "genre": genre,
                           "lang": language, "min_rating": min_rating}
    if genre:
        filters.append("%(genre)s = ANY(bs.genres)")
    if language:
        filters.append("bs.language = %(lang)s")
    if min_rating is not None:
        filters.append("bs.avg_rating >= %(min_rating)s")
    where_filters = "".join(f" AND {f}" for f in filters)

    if not q and not filters:
        return {"books": [], "authors": [], "genres": []}

    with db.cursor() as cur:
        if q:
            cur.execute(
                f"""
                SELECT {BOOK_CARD}, round(s.score::numeric, 3) AS score
                FROM book_summary bs
                CROSS JOIN LATERAL (
                    SELECT GREATEST(
                        word_similarity(%(q)s, lower(bs.title)),
                        word_similarity(%(q)s, lower(COALESCE(bs.subtitle, ''))) * 0.6,
                        word_similarity(%(q)s, lower(array_to_string(bs.authors, ' '))) * 0.9,
                        word_similarity(%(q)s, lower(array_to_string(bs.genres, ' '))) * 0.7,
                        CASE WHEN bs.isbn = replace(%(q)s, '-', '') THEN 1 ELSE 0 END
                    ) AS score
                ) s
                WHERE s.score >= %(t)s {where_filters}
                ORDER BY s.score DESC, bs.avg_rating DESC
                LIMIT 40
                """,
                params,
            )
        else:
            cur.execute(
                f"""
                SELECT {BOOK_CARD}, 0 AS score FROM book_summary bs
                WHERE TRUE {where_filters}
                ORDER BY bs.avg_rating DESC, bs.ratings_count DESC
                LIMIT 40
                """,
                params,
            )
        books = cur.fetchall()

        authors, genres = [], []
        if q:
            cur.execute(
                """
                SELECT a.name, a.bio AS description, a.photo_url, count(ba.book_id) AS book_count,
                       round(word_similarity(%(q)s, lower(a.name))::numeric, 3) AS score,
                       EXISTS (SELECT 1 FROM author_follow af
                               WHERE af.author_id = a.author_id AND af.user_id = app_user_id()) AS is_followed
                FROM author a
                LEFT JOIN book_author ba USING (author_id)
                WHERE word_similarity(%(q)s, lower(a.name)) >= %(t)s
                GROUP BY a.author_id
                ORDER BY score DESC, book_count DESC
                LIMIT 10
                """,
                params,
            )
            authors = _with_images(cur.fetchall())

            cur.execute(
                """
                SELECT g.name, count(bg.book_id) AS book_count,
                       round(word_similarity(%(q)s, lower(g.name))::numeric, 3) AS score
                FROM genre g
                LEFT JOIN book_genre bg USING (genre_id)
                WHERE word_similarity(%(q)s, lower(g.name)) >= %(t)s
                GROUP BY g.genre_id
                ORDER BY score DESC, book_count DESC
                LIMIT 10
                """,
                params,
            )
            genres = cur.fetchall()

    if q:
        mongo.log_activity("search", user_id=viewer.user_id if viewer else None, query=q)
    return {"books": books, "authors": authors, "genres": genres}


def list_genres():
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT g.genre_id, g.name, g.parent_genre_id, count(bg.book_id) AS book_count
            FROM genre g LEFT JOIN book_genre bg USING (genre_id)
            GROUP BY g.genre_id ORDER BY book_count DESC, g.name
            """
        )
        return cur.fetchall()


def list_languages():
    with db.cursor() as cur:
        cur.execute("SELECT language, count(*) AS book_count FROM book GROUP BY language ORDER BY 2 DESC")
        return cur.fetchall()


# =====================================================================
# BOOKS
# =====================================================================

def get_all_books():
    with db.cursor() as cur:
        cur.execute(f"SELECT {BOOK_CARD} FROM book_summary bs ORDER BY bs.title")
        return cur.fetchall()


def get_db_stats():
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT (SELECT count(*) FROM book)   AS books_count,
                   (SELECT count(*) FROM author) AS authors_count,
                   (SELECT count(*) FROM genre)  AS categories_count,
                   (SELECT count(*) FROM users)  AS users_count
            """
        )
        return cur.fetchone()


def get_book_details(title: str, viewer=None):
    with db.cursor() as cur:
        cur.execute(
            f"""
            SELECT {BOOK_CARD},
                   b.description,
                   b.language,
                   b.pub_year      AS published_year,
                   b.page_count    AS num_pages,
                   b.ratings_count,
                   b.isbn          AS isbn13,
                   p.name          AS publisher,
                   (SELECT status FROM shelf s WHERE s.book_id = b.book_id AND s.user_id = app_user_id()) AS shelf_status
            FROM book_summary bs
            JOIN book b USING (book_id)
            LEFT JOIN publisher p USING (publisher_id)
            WHERE b.title = %s
            """,
            (title,),
        )
        book = cur.fetchone()
        if not book:
            return None

        # My diary entries for this book
        cur.execute(
            """
            SELECT entry_id, rating, review_text, date_read, is_liked, created_at
            FROM diary_entry WHERE book_id = %s AND user_id = app_user_id()
            ORDER BY created_at DESC
            """,
            (book["book_id"],),
        )
        book["my_entries"] = cur.fetchall()

        # People I follow who logged it (RLS hides private diaries)
        cur.execute(
            """
            SELECT u.username, max(d.rating) AS rating, bool_or(d.is_liked) AS liked
            FROM user_follow uf
            JOIN users u ON u.user_id = uf.followee_id
            JOIN diary_entry d ON d.user_id = u.user_id AND d.book_id = %s
            WHERE uf.follower_id = app_user_id()
            GROUP BY u.user_id ORDER BY u.username
            """,
            (book["book_id"],),
        )
        book["friends_who_read"] = cur.fetchall()

    # Backward-compatible fields
    latest = book["my_entries"][0] if book["my_entries"] else None
    book["in_library"] = latest is not None
    book["user_rating"] = latest["rating"] if latest else None
    book["user_review"] = latest["review_text"] if latest else None
    book["isbn10"] = None

    mongo.log_activity("view", user_id=viewer.user_id if viewer else None, book_id=book["book_id"])
    return book


def get_similar_books(title: str):
    """Books sharing genres with the given book, boosted by rating, popularity and friends who read them."""
    with db.cursor() as cur:
        cur.execute(
            f"""
            WITH src AS (SELECT book_id FROM book WHERE title = %(title)s),
            overlap AS (
                SELECT bg2.book_id, count(*) AS shared
                FROM book_genre bg1
                JOIN book_genre bg2 ON bg2.genre_id = bg1.genre_id
                WHERE bg1.book_id = (SELECT book_id FROM src)
                  AND bg2.book_id <> bg1.book_id
                GROUP BY bg2.book_id
            ),
            friends_read AS (
                SELECT de.book_id, count(DISTINCT de.user_id) AS n
                FROM user_follow uf
                JOIN diary_entry de ON de.user_id = uf.followee_id
                WHERE uf.follower_id = app_user_id()
                GROUP BY de.book_id
            )
            SELECT {BOOK_CARD},
                   round((5 * o.shared + 3 * bs.avg_rating + 2 * ln(1 + bs.ratings_count)
                          + 2 * COALESCE(f.n, 0))::numeric, 2) AS score
            FROM overlap o
            JOIN book_summary bs USING (book_id)
            LEFT JOIN friends_read f USING (book_id)
            ORDER BY score DESC
            LIMIT 10
            """,
            {"title": title},
        )
        return cur.fetchall()


def get_trending(limit=12):
    """Most viewed/clicked books this week (MongoDB activity logs); falls back to most rated."""
    ranked = mongo.trending_book_ids(limit=limit)
    books = books_by_ids([b for b, _ in ranked])
    if len(books) < limit:
        with db.cursor() as cur:
            cur.execute(
                f"""SELECT {BOOK_CARD} FROM book_summary bs
                    WHERE NOT (bs.book_id = ANY(%s))
                    ORDER BY bs.ratings_count DESC LIMIT %s""",
                ([b["book_id"] for b in books], limit - len(books)),
            )
            books += cur.fetchall()
    return books


# =====================================================================
# RECOMMENDATIONS (each with a reason)
# =====================================================================

def _rec_liked_books(cur):
    """Books like the ones I rated 4+ or liked (shared author or 2+ shared genres)."""
    cur.execute(
        """
        WITH liked AS (
            SELECT DISTINCT ON (d.book_id) d.book_id, b.title, d.created_at
            FROM diary_entry d JOIN book b USING (book_id)
            WHERE d.user_id = app_user_id() AND (d.rating >= 4 OR d.is_liked)
            ORDER BY d.book_id, d.created_at DESC
        ),
        recent AS (SELECT * FROM liked ORDER BY created_at DESC LIMIT 5),
        cand AS (
            SELECT r.title AS because, c.book_id,
                   (SELECT count(*) FROM book_genre g1 JOIN book_genre g2 USING (genre_id)
                    WHERE g1.book_id = r.book_id AND g2.book_id = c.book_id) AS shared_genres,
                   EXISTS (SELECT 1 FROM book_author a1 JOIN book_author a2 USING (author_id)
                           WHERE a1.book_id = r.book_id AND a2.book_id = c.book_id) AS same_author
            FROM recent r
            CROSS JOIN LATERAL (
                SELECT bg2.book_id FROM book_genre bg1
                JOIN book_genre bg2 ON bg2.genre_id = bg1.genre_id AND bg2.book_id <> bg1.book_id
                WHERE bg1.book_id = r.book_id
                UNION
                SELECT ba2.book_id FROM book_author ba1
                JOIN book_author ba2 ON ba2.author_id = ba1.author_id AND ba2.book_id <> ba1.book_id
                WHERE ba1.book_id = r.book_id
            ) c
        )
        SELECT DISTINCT ON (c.book_id) c.book_id, 'Because you liked ' || c.because AS reason,
               (CASE WHEN c.same_author THEN 3 ELSE 0 END + c.shared_genres + b.avg_rating) AS score
        FROM cand c JOIN book b USING (book_id)
        WHERE c.same_author OR c.shared_genres >= 2
        ORDER BY c.book_id, score DESC
        """
    )
    return sorted(cur.fetchall(), key=lambda r: -r["score"])[:10]


def _rec_friends(cur):
    cur.execute(
        """
        SELECT d.book_id,
               CASE WHEN count(DISTINCT u.user_id) = 1
                    THEN '@' || min(u.username) || ' rated it ' || COALESCE(max(d.rating)::text || '★', 'highly')
                    ELSE count(DISTINCT u.user_id) || ' people you follow loved it' END AS reason,
               count(DISTINCT u.user_id) AS score
        FROM user_follow uf
        JOIN users u ON u.user_id = uf.followee_id
        JOIN diary_entry d ON d.user_id = u.user_id
        WHERE uf.follower_id = app_user_id() AND (d.rating >= 4 OR d.is_liked)
        GROUP BY d.book_id
        ORDER BY score DESC, max(d.created_at) DESC
        LIMIT 10
        """
    )
    return cur.fetchall()


def _rec_followed_authors(cur):
    cur.execute(
        """
        SELECT DISTINCT ON (ba.book_id) ba.book_id, 'By ' || a.name || ', who you follow' AS reason,
               b.avg_rating AS score
        FROM author_follow af
        JOIN author a USING (author_id)
        JOIN book_author ba ON ba.author_id = af.author_id
        JOIN book b ON b.book_id = ba.book_id
        WHERE af.user_id = app_user_id()
        ORDER BY ba.book_id
        """
    )
    return sorted(cur.fetchall(), key=lambda r: -r["score"])[:10]


def _rec_favourite_genres(cur):
    cur.execute(
        """
        SELECT * FROM (
            SELECT DISTINCT ON (bg.book_id) bg.book_id, 'Because you like ' || g.name AS reason,
                   b.avg_rating * ln(2 + b.ratings_count) AS score
            FROM user_genre ug
            JOIN genre g USING (genre_id)
            JOIN book_genre bg ON bg.genre_id = ug.genre_id
            JOIN book b ON b.book_id = bg.book_id
            WHERE ug.user_id = app_user_id()
            ORDER BY bg.book_id
        ) x ORDER BY score DESC LIMIT 12
        """
    )
    return cur.fetchall()


def get_recommendations_for(viewer, use_cache=True):
    """
    Personal recommendations from several sources, each with a reason:
      your highly rated books, readers with similar taste (Neo4j), people you
      follow, authors you follow, your favourite genres, and trending (MongoDB).
    Cached in MongoDB with a TTL index (expires after an hour).
    """
    if use_cache:
        cached = mongo.get_cached_recommendations(viewer.user_id)
        if cached is not None:
            ids = [c["book_id"] for c in cached]
            cards = {b["book_id"]: b for b in books_by_ids(ids)}
            return [{**cards[c["book_id"]], "reason": c["reason"], "source": c["source"]}
                    for c in cached if c["book_id"] in cards]

    sources = []
    with db.cursor() as cur:
        cur.execute(
            """SELECT book_id FROM diary_entry WHERE user_id = app_user_id()
               UNION SELECT book_id FROM shelf WHERE user_id = app_user_id()"""
        )
        exclude = {r["book_id"] for r in cur.fetchall()}
        sources.append(("liked", _rec_liked_books(cur)))
        sources.append(("friends", _rec_friends(cur)))
        sources.append(("authors", _rec_followed_authors(cur)))
        sources.append(("genres", _rec_favourite_genres(cur)))

    try:
        similar = graph.similar_taste_books(viewer.user_id)
        sources.insert(1, ("similar_taste", [
            {"book_id": r["book_id"],
             "reason": f"{r['readers']} reader{'s' if r['readers'] != 1 else ''} with similar taste rated it 4+"}
            for r in similar]))
    except graph.GraphUnavailable:
        pass

    sources.append(("trending", [{"book_id": b, "reason": "Trending this week"} for b, _ in mongo.trending_book_ids()]))

    # Interleave sources so every kind of reason shows up near the top
    picked, seen = [], set(exclude)
    queues = [(name, list(items)) for name, items in sources]
    while len(picked) < 24 and any(q for _, q in queues):
        for name, q in queues:
            while q:
                item = q.pop(0)
                if item["book_id"] not in seen:
                    seen.add(item["book_id"])
                    picked.append({"book_id": item["book_id"], "reason": item["reason"], "source": name})
                    break

    if len(picked) < 12:  # brand-new user with no signals yet
        with db.cursor() as cur:
            cur.execute(
                "SELECT book_id FROM book WHERE NOT (book_id = ANY(%s)) ORDER BY avg_rating * ln(2 + ratings_count) DESC LIMIT %s",
                (list(seen), 12 - len(picked)),
            )
            picked += [{"book_id": r["book_id"], "reason": "Highly rated by readers", "source": "popular"}
                       for r in cur.fetchall()]

    mongo.save_recommendations(viewer.user_id, picked)
    cards = {b["book_id"]: b for b in books_by_ids([p["book_id"] for p in picked])}
    return [{**cards[p["book_id"]], "reason": p["reason"], "source": p["source"]}
            for p in picked if p["book_id"] in cards]


# =====================================================================
# AUTHORS
# =====================================================================

def get_author_details(name: str):
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT a.author_id, a.name, a.bio AS description, a.photo_url,
                   EXISTS (SELECT 1 FROM author_follow af
                           WHERE af.author_id = a.author_id AND af.user_id = app_user_id()) AS is_followed,
                   (SELECT count(*) FROM author_follow af WHERE af.author_id = a.author_id) AS followers
            FROM author a WHERE a.name = %s
            """,
            (name,),
        )
        author = cur.fetchone()
        if not author:
            return None
        author_id = author["author_id"]

        cur.execute(
            """
            SELECT count(*) AS total_books,
                   COALESCE(round(avg(b.avg_rating), 2), 0) AS avg_rating,
                   COALESCE(sum(b.ratings_count), 0) AS total_ratings,
                   COALESCE(sum(b.page_count), 0) AS total_pages
            FROM book_author ba JOIN book b USING (book_id)
            WHERE ba.author_id = %s
            """,
            (author_id,),
        )
        stats = cur.fetchone()

        cur.execute(
            """
            SELECT g.name FROM book_author ba
            JOIN book_genre bg USING (book_id) JOIN genre g USING (genre_id)
            WHERE ba.author_id = %s
            GROUP BY g.genre_id ORDER BY count(*) DESC, g.name
            """,
            (author_id,),
        )
        genres = [r["name"] for r in cur.fetchall()]

        cur.execute(
            f"""
            SELECT {BOOK_CARD} FROM book_summary bs
            WHERE bs.book_id IN (SELECT book_id FROM book_author WHERE author_id = %s)
            ORDER BY bs.avg_rating DESC
            """,
            (author_id,),
        )
        books = cur.fetchall()

        cur.execute(
            """
            SELECT oa.name, count(DISTINCT oba.book_id) AS shared_books,
                   array_agg(DISTINCT g.name) AS shared_genres
            FROM book_author ba
            JOIN book_genre bg  ON bg.book_id = ba.book_id
            JOIN book_genre obg ON obg.genre_id = bg.genre_id
            JOIN book_author oba ON oba.book_id = obg.book_id
            JOIN author oa ON oa.author_id = oba.author_id
            JOIN genre g ON g.genre_id = bg.genre_id
            WHERE ba.author_id = %s AND oa.author_id <> %s
            GROUP BY oa.author_id
            ORDER BY shared_books DESC, oa.name
            LIMIT 5
            """,
            (author_id, author_id),
        )
        co_authors = cur.fetchall()

    return {
        "author_id": author_id,
        "name": author["name"],
        "description": author["description"],
        "image_url": get_actual_image_url(author["name"], author["photo_url"]),
        "is_followed": author["is_followed"],
        "followers": author["followers"],
        "stats": stats,
        "genres": genres,
        "books": books,
        "co_authors": co_authors,
    }


def follow_author(viewer, author_name: str) -> bool:
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO author_follow (user_id, author_id)
            SELECT %s, author_id FROM author WHERE name = %s
            ON CONFLICT DO NOTHING
            """,
            (viewer.user_id, author_name),
        )
        cur.execute("SELECT 1 FROM author WHERE name = %s", (author_name,))
        found = cur.fetchone() is not None
    mongo.clear_recommendations(viewer.user_id)
    return found


def unfollow_author(viewer, author_name: str) -> bool:
    with db.cursor() as cur:
        cur.execute(
            """
            DELETE FROM author_follow af USING author a
            WHERE af.author_id = a.author_id AND af.user_id = %s AND a.name = %s
            """,
            (viewer.user_id, author_name),
        )
        removed = cur.rowcount > 0
    mongo.clear_recommendations(viewer.user_id)
    return removed


def get_followed_authors(user_id: int):
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT a.name, a.bio AS description, a.photo_url, count(ba.book_id) AS book_count, TRUE AS is_followed
            FROM author_follow af
            JOIN author a USING (author_id)
            LEFT JOIN book_author ba ON ba.author_id = a.author_id
            WHERE af.user_id = %s
            GROUP BY a.author_id
            ORDER BY a.name
            """,
            (user_id,),
        )
        return _with_images(cur.fetchall())
