"""
Lists: public or private ranked book lists, with likes and comments.
"""
from fastapi import HTTPException

from app.database import db
from app.services.book_service import BOOK_CARD

LIST_SUMMARY = """
    l.list_id, l.name, l.description, l.is_public, l.created_at, l.updated_at,
    u.username, u.user_id,
    (SELECT count(*) FROM list_book lb WHERE lb.list_id = l.list_id) AS book_count,
    (SELECT count(*) FROM list_like ll WHERE ll.list_id = l.list_id) AS like_count,
    (SELECT count(*) FROM comment c WHERE c.list_id = l.list_id) AS comment_count,
    EXISTS (SELECT 1 FROM list_like ll WHERE ll.list_id = l.list_id AND ll.user_id = app_user_id()) AS liked_by_me,
    ARRAY(SELECT b.cover_url FROM list_book lb JOIN book b USING (book_id)
          WHERE lb.list_id = l.list_id ORDER BY lb.position LIMIT 4) AS covers
"""

VISIBLE = "(l.is_public OR l.user_id = app_user_id())"


def browse_lists(sort="popular", limit=30):
    order = "like_count DESC, l.updated_at DESC" if sort == "popular" else "l.created_at DESC"
    with db.cursor() as cur:
        cur.execute(
            f"""SELECT {LIST_SUMMARY} FROM list l JOIN users u USING (user_id)
                WHERE l.is_public AND EXISTS (SELECT 1 FROM list_book lb WHERE lb.list_id = l.list_id)
                ORDER BY {order} LIMIT %s""",
            (limit,),
        )
        return cur.fetchall()


def user_lists(user_id, book_id=None):
    """A user's lists (private ones only for the owner). With book_id, also says if it's in each list."""
    with db.cursor() as cur:
        cur.execute(
            f"""SELECT {LIST_SUMMARY},
                       EXISTS (SELECT 1 FROM list_book lb WHERE lb.list_id = l.list_id AND lb.book_id = %s) AS has_book
                FROM list l JOIN users u USING (user_id)
                WHERE l.user_id = %s AND {VISIBLE}
                ORDER BY l.updated_at DESC""",
            (book_id, user_id),
        )
        return cur.fetchall()


def get_list(list_id):
    with db.cursor() as cur:
        cur.execute(f"SELECT {LIST_SUMMARY} FROM list l JOIN users u USING (user_id) WHERE l.list_id = %s AND {VISIBLE}",
                    (list_id,))
        lst = cur.fetchone()
        if not lst:
            raise HTTPException(404, "List not found")
        cur.execute(
            f"""SELECT lb.position, lb.added_at, {BOOK_CARD}
                FROM list_book lb JOIN book_summary bs ON bs.book_id = lb.book_id
                WHERE lb.list_id = %s ORDER BY lb.position""",
            (list_id,),
        )
        lst["books"] = cur.fetchall()
    return lst


def _own_list(cur, viewer, list_id):
    cur.execute("SELECT user_id FROM list WHERE list_id = %s FOR UPDATE", (list_id,))
    row = cur.fetchone()
    if not row or row["user_id"] != viewer.user_id:
        raise HTTPException(404, "List not found")


def create_list(viewer, name, description=None, is_public=True, book_ids=None):
    name = (name or "").strip()
    if not name:
        raise HTTPException(400, "List name is required")
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO list (user_id, name, description, is_public) VALUES (%s, %s, %s, %s) RETURNING list_id",
            (viewer.user_id, name[:200], (description or "").strip() or None, is_public),
        )
        list_id = cur.fetchone()["list_id"]
        for pos, book_id in enumerate(book_ids or [], start=1):
            cur.execute("INSERT INTO list_book (list_id, book_id, position) VALUES (%s, %s, %s)",
                        (list_id, book_id, pos))
    return get_list(list_id)


def update_list(viewer, list_id, fields):
    allowed = {k: v for k, v in fields.items() if k in ("name", "description", "is_public") and v is not None}
    with db.cursor() as cur:
        _own_list(cur, viewer, list_id)
        if allowed:
            sets = ", ".join(f"{k} = %({k})s" for k in allowed)
            cur.execute(f"UPDATE list SET {sets}, updated_at = now() WHERE list_id = %(id)s", {**allowed, "id": list_id})
    return get_list(list_id)


def delete_list(viewer, list_id):
    with db.cursor() as cur:
        _own_list(cur, viewer, list_id)
        cur.execute("DELETE FROM list WHERE list_id = %s", (list_id,))


def add_book(viewer, list_id, book_id):
    with db.cursor() as cur:
        _own_list(cur, viewer, list_id)
        cur.execute(
            """
            INSERT INTO list_book (list_id, book_id, position)
            SELECT %(l)s, %(b)s, COALESCE(max(position), 0) + 1 FROM list_book WHERE list_id = %(l)s
            ON CONFLICT (list_id, book_id) DO NOTHING
            """,
            {"l": list_id, "b": book_id},
        )
        cur.execute("UPDATE list SET updated_at = now() WHERE list_id = %s", (list_id,))
    return get_list(list_id)


def remove_book(viewer, list_id, book_id):
    with db.cursor() as cur:
        _own_list(cur, viewer, list_id)
        cur.execute("DELETE FROM list_book WHERE list_id = %s AND book_id = %s", (list_id, book_id))
        # close the gap; the UNIQUE(list_id, position) check is deferred to commit
        cur.execute(
            """
            UPDATE list_book lb SET position = r.rn
            FROM (SELECT book_id, row_number() OVER (ORDER BY position) AS rn
                  FROM list_book WHERE list_id = %(l)s) r
            WHERE lb.list_id = %(l)s AND lb.book_id = r.book_id
            """,
            {"l": list_id},
        )
        cur.execute("UPDATE list SET updated_at = now() WHERE list_id = %s", (list_id,))
    return get_list(list_id)


def reorder(viewer, list_id, book_ids):
    """Re-ranks the whole list in one transaction (positions 1..n)."""
    with db.cursor() as cur:
        _own_list(cur, viewer, list_id)
        cur.execute("SELECT book_id FROM list_book WHERE list_id = %s", (list_id,))
        current = {r["book_id"] for r in cur.fetchall()}
        if set(book_ids) != current or len(book_ids) != len(current):
            raise HTTPException(400, "Send every book in the list exactly once")
        for pos, book_id in enumerate(book_ids, start=1):
            cur.execute("UPDATE list_book SET position = %s WHERE list_id = %s AND book_id = %s",
                        (pos, list_id, book_id))
        cur.execute("UPDATE list SET updated_at = now() WHERE list_id = %s", (list_id,))
    return get_list(list_id)


def toggle_like(viewer, list_id):
    with db.cursor() as cur:
        cur.execute(f"SELECT 1 FROM list l WHERE l.list_id = %s AND {VISIBLE}", (list_id,))
        if not cur.fetchone():
            raise HTTPException(404, "List not found")
        cur.execute("DELETE FROM list_like WHERE user_id = %s AND list_id = %s", (viewer.user_id, list_id))
        liked = cur.rowcount == 0
        if liked:
            cur.execute("INSERT INTO list_like (user_id, list_id) VALUES (%s, %s)", (viewer.user_id, list_id))
        cur.execute("SELECT count(*) AS n FROM list_like WHERE list_id = %s", (list_id,))
        return {"liked": liked, "like_count": cur.fetchone()["n"]}
