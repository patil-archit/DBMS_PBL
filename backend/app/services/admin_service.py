"""
Admin and moderation: catalogue management, reported reviews, reports,
audit log and user roles. Every change made here is recorded by the
audit triggers in PostgreSQL (they read app.user_id for "changed_by").
"""
from fastapi import HTTPException
from psycopg2 import errors

from app import sync_worker
from app.database import db


def _upsert_names(cur, table, id_col, names):
    ids = []
    for name in dict.fromkeys(n.strip() for n in names if n and n.strip()):
        cur.execute(
            f"INSERT INTO {table} (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING {id_col}",
            (name,),
        )
        ids.append(cur.fetchone()[id_col])
    return ids


# =====================================================================
# BOOKS
# =====================================================================

BOOK_FIELDS = ("title", "subtitle", "isbn", "language", "description", "pub_year", "page_count", "cover_url")


def get_book_admin(book_id):
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT b.book_id, b.title, b.subtitle, b.isbn, b.language, b.description, b.pub_year,
                   b.page_count, b.cover_url, b.avg_rating, b.ratings_count, p.name AS publisher,
                   ARRAY(SELECT a.name FROM book_author ba JOIN author a USING (author_id) WHERE ba.book_id = b.book_id) AS authors,
                   ARRAY(SELECT g.name FROM book_genre bg JOIN genre g USING (genre_id) WHERE bg.book_id = b.book_id) AS genres
            FROM book b LEFT JOIN publisher p USING (publisher_id) WHERE b.book_id = %s
            """,
            (book_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Book not found")
    return row


def save_book(data: dict, book_id=None):
    fields = {k: data.get(k) for k in BOOK_FIELDS}
    fields["title"] = (fields["title"] or "").strip()
    if not fields["title"]:
        raise HTTPException(400, "Title is required")
    fields["language"] = fields["language"] or "en"
    for k in ("subtitle", "isbn", "description", "cover_url"):
        fields[k] = (fields[k] or "").strip() or None
    try:
        with db.cursor() as cur:
            publisher = (data.get("publisher") or "").strip()
            fields["publisher_id"] = _upsert_names(cur, "publisher", "publisher_id", [publisher])[0] if publisher else None
            if book_id:
                sets = ", ".join(f"{k} = %({k})s" for k in fields)
                cur.execute(f"UPDATE book SET {sets} WHERE book_id = %(id)s", {**fields, "id": book_id})
                if cur.rowcount == 0:
                    raise HTTPException(404, "Book not found")
            else:
                cols = ", ".join(fields)
                vals = ", ".join(f"%({k})s" for k in fields)
                cur.execute(f"INSERT INTO book ({cols}) VALUES ({vals}) RETURNING book_id", fields)
                book_id = cur.fetchone()["book_id"]
            if data.get("authors") is not None:
                cur.execute("DELETE FROM book_author WHERE book_id = %s", (book_id,))
                for aid in _upsert_names(cur, "author", "author_id", data["authors"]):
                    cur.execute("INSERT INTO book_author VALUES (%s, %s)", (aid, book_id))
            if data.get("genres") is not None:
                cur.execute("DELETE FROM book_genre WHERE book_id = %s", (book_id,))
                for gid in _upsert_names(cur, "genre", "genre_id", data["genres"]):
                    cur.execute("INSERT INTO book_genre VALUES (%s, %s)", (gid, book_id))
    except errors.UniqueViolation:
        raise HTTPException(409, "A book with that title or ISBN already exists")
    except errors.CheckViolation as e:
        raise HTTPException(400, f"Invalid value: {e.diag.constraint_name}")
    return get_book_admin(book_id)


def delete_book(book_id):
    with db.cursor() as cur:
        cur.execute("DELETE FROM book WHERE book_id = %s", (book_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Book not found")


def list_books_admin(q="", limit=50):
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT b.book_id, b.title, b.pub_year, b.avg_rating, b.ratings_count,
                   array_to_string(ARRAY(SELECT a.name FROM book_author ba JOIN author a USING (author_id)
                                         WHERE ba.book_id = b.book_id), ', ') AS authors
            FROM book b
            WHERE %(q)s = '' OR lower(b.title) LIKE '%%' || lower(%(q)s) || '%%' OR b.isbn = %(q)s
            ORDER BY b.title LIMIT %(limit)s
            """,
            {"q": q or "", "limit": limit},
        )
        return cur.fetchall()


# =====================================================================
# AUTHORS & GENRES
# =====================================================================

def list_authors_admin(q="", limit=50):
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT a.author_id, a.name, a.bio, a.photo_url, count(ba.book_id) AS book_count
            FROM author a LEFT JOIN book_author ba USING (author_id)
            WHERE %(q)s = '' OR lower(a.name) LIKE '%%' || lower(%(q)s) || '%%'
            GROUP BY a.author_id ORDER BY a.name LIMIT %(limit)s
            """,
            {"q": q or "", "limit": limit},
        )
        return cur.fetchall()


def save_author(data, author_id=None):
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name is required")
    params = {"name": name, "bio": (data.get("bio") or "").strip() or None,
              "photo": (data.get("photo_url") or "").strip() or None, "id": author_id}
    try:
        with db.cursor() as cur:
            if author_id:
                cur.execute("UPDATE author SET name = %(name)s, bio = %(bio)s, photo_url = %(photo)s WHERE author_id = %(id)s RETURNING *", params)
            else:
                cur.execute("INSERT INTO author (name, bio, photo_url) VALUES (%(name)s, %(bio)s, %(photo)s) RETURNING *", params)
            row = cur.fetchone()
    except errors.UniqueViolation:
        raise HTTPException(409, "An author with that name already exists")
    if not row:
        raise HTTPException(404, "Author not found")
    return row


def delete_author(author_id):
    with db.cursor() as cur:
        cur.execute("DELETE FROM author WHERE author_id = %s", (author_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Author not found")


def list_genres_admin():
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT g.genre_id, g.name, g.parent_genre_id, p.name AS parent_name, count(bg.book_id) AS book_count
            FROM genre g LEFT JOIN genre p ON p.genre_id = g.parent_genre_id
            LEFT JOIN book_genre bg ON bg.genre_id = g.genre_id
            GROUP BY g.genre_id, p.name ORDER BY g.name
            """
        )
        return cur.fetchall()


def save_genre(data, genre_id=None):
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Name is required")
    params = {"name": name, "parent": data.get("parent_genre_id") or None, "id": genre_id}
    try:
        with db.cursor() as cur:
            if genre_id:
                cur.execute("UPDATE genre SET name = %(name)s, parent_genre_id = %(parent)s WHERE genre_id = %(id)s RETURNING *", params)
            else:
                cur.execute("INSERT INTO genre (name, parent_genre_id) VALUES (%(name)s, %(parent)s) RETURNING *", params)
            row = cur.fetchone()
    except errors.UniqueViolation:
        raise HTTPException(409, "A genre with that name already exists")
    except (errors.CheckViolation, errors.ForeignKeyViolation):
        raise HTTPException(400, "Invalid parent genre")
    if not row:
        raise HTTPException(404, "Genre not found")
    return row


def delete_genre(genre_id):
    with db.cursor() as cur:
        cur.execute("DELETE FROM genre WHERE genre_id = %s", (genre_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Genre not found")


# =====================================================================
# MODERATION
# =====================================================================

def list_reports(status="open"):
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT r.report_id, r.reason, r.status, r.created_at, r.resolved_at,
                   rep.username AS reporter, res.username AS resolved_by,
                   d.entry_id, d.rating, d.review_text, author.username AS review_author,
                   b.title AS book_title,
                   (SELECT count(*) FROM review_report r2 WHERE r2.entry_id = r.entry_id AND r2.status = 'open') AS open_reports
            FROM review_report r
            JOIN users rep ON rep.user_id = r.reporter_id
            LEFT JOIN users res ON res.user_id = r.resolved_by
            JOIN diary_entry d ON d.entry_id = r.entry_id
            JOIN users author ON author.user_id = d.user_id
            JOIN book b ON b.book_id = d.book_id
            WHERE r.status = %s
            ORDER BY open_reports DESC, r.created_at
            """,
            (status,),
        )
        return cur.fetchall()


def resolve_report(viewer, report_id, action):
    """action 'dismiss' keeps the review; 'remove' deletes the review (and all its reports)."""
    if action not in ("dismiss", "remove"):
        raise HTTPException(400, "action must be dismiss or remove")
    with db.cursor() as cur:
        cur.execute("SELECT entry_id FROM review_report WHERE report_id = %s FOR UPDATE", (report_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Report not found")
        if action == "dismiss":
            cur.execute(
                """UPDATE review_report SET status = 'dismissed', resolved_by = %s, resolved_at = now()
                   WHERE entry_id = %s AND status = 'open'""",
                (viewer.user_id, row["entry_id"]),
            )
        else:
            # mark first so the audit log keeps who removed it, then delete the review
            cur.execute(
                """UPDATE review_report SET status = 'removed', resolved_by = %s, resolved_at = now()
                   WHERE entry_id = %s""",
                (viewer.user_id, row["entry_id"]),
            )
            cur.execute("DELETE FROM diary_entry WHERE entry_id = %s", (row["entry_id"],))


# =====================================================================
# REPORTS (materialized views)
# =====================================================================

def analytics(refresh=True):
    with db.cursor() as cur:
        if refresh:
            cur.execute("SELECT matviewname, ispopulated FROM pg_matviews WHERE schemaname = 'public'")
            for mv in cur.fetchall():
                # CONCURRENTLY keeps the old data readable during refresh, but needs a populated view
                mode = "CONCURRENTLY " if mv["ispopulated"] else ""
                cur.execute(f"REFRESH MATERIALIZED VIEW {mode}{mv['matviewname']}")
        cur.execute("SELECT * FROM mv_most_read_books ORDER BY readers DESC, times_logged DESC LIMIT 10")
        most_read = cur.fetchall()
        cur.execute(
            """SELECT *, entries + reviews + comments + lists AS activity FROM mv_active_users
               ORDER BY activity DESC LIMIT 10"""
        )
        active_users = cur.fetchall()
        cur.execute(
            """SELECT genre, sum(logs) AS logs, round(avg(avg_rating), 2) AS avg_rating,
                      json_agg(json_build_object('month', month, 'logs', logs) ORDER BY month) AS by_month
               FROM mv_genre_trends
               WHERE month >= date_trunc('month', now()) - interval '11 months'
               GROUP BY genre ORDER BY logs DESC LIMIT 12"""
        )
        genre_trends = cur.fetchall()
        cur.execute(
            """SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM diary_entry) AS entries,
                      (SELECT count(*) FROM list) AS lists, (SELECT count(*) FROM comment) AS comments,
                      (SELECT count(*) FROM review_report WHERE status = 'open') AS open_reports,
                      (SELECT count(*) FROM book) AS books"""
        )
        totals = cur.fetchone()
    return {"totals": totals, "most_read": most_read, "active_users": active_users,
            "genre_trends": genre_trends, "sync": sync_worker.status()}


def audit_log(limit=100, table=None):
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT a.audit_id, a.table_name, a.operation, a.changed_at, u.username AS changed_by,
                   a.old_data, a.new_data
            FROM audit_log a LEFT JOIN users u ON u.user_id = a.changed_by
            WHERE %(t)s::text IS NULL OR a.table_name = %(t)s
            ORDER BY a.audit_id DESC LIMIT %(limit)s
            """,
            {"t": table, "limit": limit},
        )
        return cur.fetchall()


# =====================================================================
# USERS & ROLES
# =====================================================================

def list_users(q="", limit=50):
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT u.user_id, u.username, u.email, u.role, u.is_private, u.created_at,
                   (SELECT count(*) FROM diary_entry d WHERE d.user_id = u.user_id) AS entries
            FROM users u
            WHERE %(q)s = '' OR u.username LIKE '%%' || lower(%(q)s) || '%%' OR u.email ILIKE '%%' || %(q)s || '%%'
            ORDER BY u.created_at DESC LIMIT %(limit)s
            """,
            {"q": q or "", "limit": limit},
        )
        return cur.fetchall()


def set_role(viewer, user_id, role):
    if role not in ("reader", "moderator", "admin"):
        raise HTTPException(400, "Unknown role")
    if user_id == viewer.user_id and role != "admin":
        raise HTTPException(400, "You can't remove your own admin role")
    with db.cursor() as cur:
        cur.execute("UPDATE users SET role = %s WHERE user_id = %s RETURNING user_id, username, role", (role, user_id))
        row = cur.fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return row
