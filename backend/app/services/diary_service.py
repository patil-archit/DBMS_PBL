"""
Diary, shelves, reading goals, reviews (likes / comments / reports).

Privacy is enforced by PostgreSQL row-level security on diary_entry: queries
here simply never see entries from private diaries of other users.
"""
from datetime import date

from fastapi import HTTPException

from app import mongo
from app.database import db
from app.services.book_service import BOOK_CARD


def _book_exists(cur, book_id):
    cur.execute("SELECT 1 FROM book WHERE book_id = %s", (book_id,))
    if not cur.fetchone():
        raise HTTPException(404, "Book not found")


def _visible_entry(cur, entry_id):
    """Returns the entry if the viewer may see it (RLS decides), else 404."""
    cur.execute("SELECT entry_id, user_id, book_id FROM diary_entry WHERE entry_id = %s", (entry_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Review not found")
    return row


# =====================================================================
# DIARY
# =====================================================================

ENTRY_COLUMNS = f"""
    d.entry_id, d.rating, d.review_text, d.date_read, d.is_liked, d.created_at,
    {BOOK_CARD}
"""


def log_book(viewer, book_id, rating=None, review_text=None, date_read=None, is_liked=False):
    """
    Logs a book in one transaction: the diary row, and removing it from the
    want-to-read / currently-reading shelf. Triggers then update the book's
    rating average, the reading goal and the Neo4j sync outbox atomically.
    """
    with db.cursor() as cur:
        _book_exists(cur, book_id)
        cur.execute(
            """
            INSERT INTO diary_entry (user_id, book_id, rating, review_text, date_read, is_liked)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING entry_id
            """,
            (viewer.user_id, book_id, rating, (review_text or "").strip() or None,
             date_read or date.today(), bool(is_liked)),
        )
        entry_id = cur.fetchone()["entry_id"]
        cur.execute("DELETE FROM shelf WHERE user_id = %s AND book_id = %s", (viewer.user_id, book_id))
    mongo.clear_recommendations(viewer.user_id)
    return get_entry(entry_id)


def get_entry(entry_id):
    with db.cursor() as cur:
        cur.execute(
            f"""
            SELECT {ENTRY_COLUMNS}, u.username
            FROM diary_entry d
            JOIN book_summary bs ON bs.book_id = d.book_id
            JOIN users u ON u.user_id = d.user_id
            WHERE d.entry_id = %s
            """,
            (entry_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Diary entry not found")
    return row


def update_entry(viewer, entry_id, fields: dict):
    allowed = {"rating", "review_text", "date_read", "is_liked"}
    fields = {k: v for k, v in fields.items() if k in allowed}
    if "review_text" in fields:
        fields["review_text"] = (fields["review_text"] or "").strip() or None
    if not fields:
        return get_entry(entry_id)
    sets = ", ".join(f"{k} = %({k})s" for k in fields)
    with db.cursor() as cur:
        # RLS: the UPDATE only matches the viewer's own rows
        cur.execute(f"UPDATE diary_entry SET {sets} WHERE entry_id = %(id)s AND user_id = %(uid)s",
                    {**fields, "id": entry_id, "uid": viewer.user_id})
        if cur.rowcount == 0:
            raise HTTPException(404, "Diary entry not found")
    mongo.clear_recommendations(viewer.user_id)
    return get_entry(entry_id)


def delete_entry(viewer, entry_id):
    with db.cursor() as cur:
        cur.execute("DELETE FROM diary_entry WHERE entry_id = %s AND user_id = %s", (entry_id, viewer.user_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "Diary entry not found")
    mongo.clear_recommendations(viewer.user_id)


def get_diary(user_id, year=None):
    """A user's diary, newest first. Returns [] for a private diary you don't own (RLS)."""
    with db.cursor() as cur:
        cur.execute(
            f"""
            SELECT {ENTRY_COLUMNS}
            FROM diary_entry d JOIN book_summary bs ON bs.book_id = d.book_id
            WHERE d.user_id = %s
              AND (%s::int IS NULL OR EXTRACT(YEAR FROM d.date_read) = %s)
            ORDER BY d.date_read DESC NULLS LAST, d.created_at DESC
            """,
            (user_id, year, year),
        )
        return cur.fetchall()


def get_library_books(user_id):
    """Distinct books in a user's diary (book cards)."""
    with db.cursor() as cur:
        cur.execute(
            f"""
            SELECT {BOOK_CARD} FROM book_summary bs
            WHERE bs.book_id IN (SELECT book_id FROM diary_entry WHERE user_id = %s)
            ORDER BY bs.title
            """,
            (user_id,),
        )
        return cur.fetchall()


# =====================================================================
# SHELVES
# =====================================================================

def set_shelf(viewer, book_id, status):
    with db.cursor() as cur:
        _book_exists(cur, book_id)
        cur.execute(
            """
            INSERT INTO shelf (user_id, book_id, status) VALUES (%s, %s, %s)
            ON CONFLICT (user_id, book_id) DO UPDATE SET status = EXCLUDED.status, added_at = now()
            """,
            (viewer.user_id, book_id, status),
        )
    mongo.clear_recommendations(viewer.user_id)


def remove_shelf(viewer, book_id):
    with db.cursor() as cur:
        cur.execute("DELETE FROM shelf WHERE user_id = %s AND book_id = %s", (viewer.user_id, book_id))


def get_shelves(user_id, viewer_id):
    with db.cursor() as cur:
        cur.execute("SELECT is_private FROM users WHERE user_id = %s", (user_id,))
        owner = cur.fetchone()
        if not owner or (owner["is_private"] and user_id != viewer_id):
            return {"want_to_read": [], "currently_reading": []}
        cur.execute(
            f"""
            SELECT s.status, s.added_at, {BOOK_CARD}
            FROM shelf s JOIN book_summary bs ON bs.book_id = s.book_id
            WHERE s.user_id = %s ORDER BY s.added_at DESC
            """,
            (user_id,),
        )
        rows = cur.fetchall()
    return {
        "want_to_read": [r for r in rows if r["status"] == "want_to_read"],
        "currently_reading": [r for r in rows if r["status"] == "currently_reading"],
    }


# =====================================================================
# READING GOAL
# =====================================================================

def get_goal(user_id, year):
    with db.cursor() as cur:
        cur.execute("SELECT year, target_books, books_finished FROM reading_goal WHERE user_id = %s AND year = %s",
                    (user_id, year))
        goal = cur.fetchone()
        cur.execute("SELECT books_finished_in(%s, %s) AS n", (user_id, year))
        finished = cur.fetchone()["n"]
    if not goal:
        return {"year": year, "target_books": None, "books_finished": finished, "percent": None}
    goal["percent"] = min(100, round(100 * goal["books_finished"] / goal["target_books"]))
    return goal


def set_goal(viewer, year, target_books):
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO reading_goal (user_id, year, target_books) VALUES (%s, %s, %s)
            ON CONFLICT (user_id, year) DO UPDATE SET target_books = EXCLUDED.target_books
            """,
            (viewer.user_id, year, target_books),
        )
    return get_goal(viewer.user_id, year)


def delete_goal(viewer, year):
    with db.cursor() as cur:
        cur.execute("DELETE FROM reading_goal WHERE user_id = %s AND year = %s", (viewer.user_id, year))


# =====================================================================
# REVIEWS: list, like, comment, report
# =====================================================================

def get_book_reviews(book_id, limit=50):
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT d.entry_id, d.rating, d.review_text, d.date_read, d.is_liked, d.created_at,
                   u.username, u.user_id,
                   (SELECT count(*) FROM review_like rl WHERE rl.entry_id = d.entry_id) AS like_count,
                   EXISTS (SELECT 1 FROM review_like rl
                           WHERE rl.entry_id = d.entry_id AND rl.user_id = app_user_id()) AS liked_by_me,
                   (SELECT count(*) FROM comment c WHERE c.entry_id = d.entry_id) AS comment_count
            FROM diary_entry d JOIN users u USING (user_id)
            WHERE d.book_id = %s AND (d.review_text IS NOT NULL OR d.rating IS NOT NULL)
            ORDER BY (d.review_text IS NOT NULL) DESC, like_count DESC, d.created_at DESC
            LIMIT %s
            """,
            (book_id, limit),
        )
        return cur.fetchall()


def toggle_review_like(viewer, entry_id):
    with db.cursor() as cur:
        _visible_entry(cur, entry_id)
        cur.execute("DELETE FROM review_like WHERE user_id = %s AND entry_id = %s", (viewer.user_id, entry_id))
        liked = cur.rowcount == 0
        if liked:
            cur.execute("INSERT INTO review_like (user_id, entry_id) VALUES (%s, %s)", (viewer.user_id, entry_id))
        cur.execute("SELECT count(*) AS n FROM review_like WHERE entry_id = %s", (entry_id,))
        return {"liked": liked, "like_count": cur.fetchone()["n"]}


def _check_list_visible(cur, list_id):
    cur.execute("SELECT user_id, is_public FROM list WHERE list_id = %s", (list_id,))
    row = cur.fetchone()
    if not row or (not row["is_public"] and row["user_id"] != _viewer_id(cur)):
        raise HTTPException(404, "List not found")
    return row


def _viewer_id(cur):
    cur.execute("SELECT app_user_id() AS id")
    return cur.fetchone()["id"]


def get_comments(entry_id=None, list_id=None):
    with db.cursor() as cur:
        if entry_id:
            _visible_entry(cur, entry_id)
        else:
            _check_list_visible(cur, list_id)
        cur.execute(
            """
            SELECT c.comment_id, c.comment_text, c.created_at, u.username, u.user_id
            FROM comment c JOIN users u USING (user_id)
            WHERE (c.entry_id = %s OR c.list_id = %s)
            ORDER BY c.created_at
            """,
            (entry_id, list_id),
        )
        return cur.fetchall()


def add_comment(viewer, text, entry_id=None, list_id=None):
    text = (text or "").strip()
    if not text:
        raise HTTPException(400, "Comment cannot be empty")
    with db.cursor() as cur:
        if entry_id:
            _visible_entry(cur, entry_id)
        else:
            _check_list_visible(cur, list_id)
        cur.execute(
            """
            INSERT INTO comment (user_id, comment_text, entry_id, list_id)
            VALUES (%s, %s, %s, %s) RETURNING comment_id, comment_text, created_at
            """,
            (viewer.user_id, text, entry_id, list_id),
        )
        row = cur.fetchone()
    return {**row, "username": viewer.username, "user_id": viewer.user_id}


def delete_comment(viewer, comment_id):
    with db.cursor() as cur:
        cur.execute(
            "DELETE FROM comment WHERE comment_id = %s AND (user_id = %s OR %s)",
            (comment_id, viewer.user_id, viewer.is_staff),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Comment not found")


def report_review(viewer, entry_id, reason):
    reason = (reason or "").strip()
    if not reason:
        raise HTTPException(400, "Please give a reason")
    with db.cursor() as cur:
        entry = _visible_entry(cur, entry_id)
        if entry["user_id"] == viewer.user_id:
            raise HTTPException(400, "You can't report your own review")
        cur.execute(
            """
            INSERT INTO review_report (entry_id, reporter_id, reason) VALUES (%s, %s, %s)
            ON CONFLICT (entry_id, reporter_id) DO UPDATE SET reason = EXCLUDED.reason, status = 'open'
            """,
            (entry_id, viewer.user_id, reason[:500]),
        )
