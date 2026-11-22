"""
Connecting readers: direct messages, notifications, presence and
"reading now" with the people you follow.

  messages      MongoDB  one document per message, grouped by a thread key
  presence      MongoDB  last time each reader was active (for "online now")
  user_state    MongoDB  when each reader last opened their notifications
  notifications PostgreSQL, computed from follows, review likes, comments
                and list likes (no new tables)

You can message someone when either of you follows the other.
"""
from datetime import datetime, timedelta

from fastapi import HTTPException

from app import mongo
from app.database import db
from app.services.book_service import BOOK_CARD

ONLINE_WINDOW = timedelta(minutes=2)


def _iso(ts):
    return ts.isoformat() if isinstance(ts, datetime) else ts


def _thread(a, b):
    return f"{min(a, b)}:{max(a, b)}"


def _user(cur, username):
    cur.execute("SELECT user_id, username FROM users WHERE username = %s", (username,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return row


def _connected(cur, a, b):
    cur.execute(
        "SELECT 1 FROM user_follow WHERE (follower_id = %s AND followee_id = %s) OR (follower_id = %s AND followee_id = %s)",
        (a, b, b, a),
    )
    return cur.fetchone() is not None


# ---------------------------------------------------------------------
# Presence
# ---------------------------------------------------------------------
def touch(user_id):
    try:
        mongo.get_db().presence.update_one({"user_id": user_id}, {"$set": {"ts": mongo.now()}}, upsert=True)
    except Exception:
        pass


def online_ids(user_ids):
    if not user_ids:
        return set()
    try:
        since = mongo.now() - ONLINE_WINDOW
        return {d["user_id"] for d in mongo.get_db().presence.find({"user_id": {"$in": list(user_ids)}, "ts": {"$gte": since}})}
    except Exception:
        return set()


# ---------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------
def _msg(doc, me):
    return {
        "message_id": str(doc["_id"]),
        "from": doc["from_username"],
        "mine": doc["from"] == me,
        "text": doc.get("text"),
        "book": doc.get("book"),
        "created_at": _iso(doc["created_at"]),
        "read": doc.get("read", False),
    }


def threads(viewer):
    try:
        pipeline = [
            {"$match": {"$or": [{"from": viewer.user_id}, {"to": viewer.user_id}]}},
            {"$sort": {"created_at": -1}},
            {"$group": {
                "_id": "$thread",
                "last": {"$first": "$$ROOT"},
                "unread": {"$sum": {"$cond": [{"$and": [{"$eq": ["$to", viewer.user_id]}, {"$eq": ["$read", False]}]}, 1, 0]}},
            }},
            {"$sort": {"last.created_at": -1}},
        ]
        rows = list(mongo.get_db().messages.aggregate(pipeline))
    except Exception:
        raise HTTPException(503, "Messages are unavailable right now (MongoDB)")
    other_ids = [r["last"]["to"] if r["last"]["from"] == viewer.user_id else r["last"]["from"] for r in rows]
    names = {}
    if other_ids:
        with db.cursor() as cur:
            cur.execute("SELECT user_id, username FROM users WHERE user_id = ANY(%s)", (other_ids,))
            names = {r["user_id"]: r["username"] for r in cur.fetchall()}
    online = online_ids(other_ids)
    out = []
    for r, oid in zip(rows, other_ids):
        if oid not in names:
            continue  # account deleted
        out.append({"username": names[oid], "online": oid in online, "unread": r["unread"], "last": _msg(r["last"], viewer.user_id)})
    return out


def contacts(viewer):
    """People you can message: anyone you follow or who follows you."""
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT u.user_id, u.username,
                   EXISTS (SELECT 1 FROM user_follow f WHERE f.follower_id = %(me)s AND f.followee_id = u.user_id) AS you_follow,
                   EXISTS (SELECT 1 FROM user_follow f WHERE f.follower_id = u.user_id AND f.followee_id = %(me)s) AS follows_you
            FROM users u
            WHERE u.user_id <> %(me)s AND u.user_id IN (
                SELECT followee_id FROM user_follow WHERE follower_id = %(me)s
                UNION SELECT follower_id FROM user_follow WHERE followee_id = %(me)s)
            ORDER BY u.username
            """,
            {"me": viewer.user_id},
        )
        rows = cur.fetchall()
    online = online_ids([r["user_id"] for r in rows])
    return [{"username": r["username"], "you_follow": r["you_follow"], "follows_you": r["follows_you"],
             "online": r["user_id"] in online} for r in rows]


def conversation(viewer, username, limit=60):
    with db.cursor() as cur:
        other = _user(cur, username)
        can = _connected(cur, viewer.user_id, other["user_id"])
    try:
        docs = list(mongo.get_db().messages.find({"thread": _thread(viewer.user_id, other["user_id"])})
                    .sort("created_at", -1).limit(limit))
    except Exception:
        raise HTTPException(503, "Messages are unavailable right now (MongoDB)")
    docs.reverse()
    return {
        "username": other["username"],
        "can_message": can,
        "online": other["user_id"] in online_ids([other["user_id"]]),
        "messages": [_msg(d, viewer.user_id) for d in docs],
    }


def send(viewer, username, text=None, book_id=None):
    text = (text or "").strip()
    if not text and not book_id:
        raise HTTPException(422, "Write something or attach a book")
    if len(text) > 1000:
        raise HTTPException(422, "Messages are at most 1000 characters")
    with db.cursor() as cur:
        other = _user(cur, username)
        if other["user_id"] == viewer.user_id:
            raise HTTPException(400, "You can't message yourself")
        if not _connected(cur, viewer.user_id, other["user_id"]):
            raise HTTPException(403, "You can message people you follow or who follow you")
        book = None
        if book_id:
            cur.execute(f"SELECT {BOOK_CARD} FROM book_summary bs WHERE bs.book_id = %s", (book_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Book not found")
            book = {"book_id": row["book_id"], "title": row["title"], "thumbnail": row["thumbnail"],
                    "authors": row["authors"], "average_rating": float(row["average_rating"] or 0)}
    doc = {
        "thread": _thread(viewer.user_id, other["user_id"]),
        "from": viewer.user_id, "to": other["user_id"], "from_username": viewer.username,
        "text": text or None, "book": book, "read": False, "created_at": mongo.now(),
    }
    try:
        doc["_id"] = mongo.get_db().messages.insert_one(doc).inserted_id
    except Exception:
        raise HTTPException(503, "Messages are unavailable right now (MongoDB)")
    touch(viewer.user_id)
    return _msg(doc, viewer.user_id)


def mark_read(viewer, username):
    with db.cursor() as cur:
        other = _user(cur, username)
    r = mongo.get_db().messages.update_many(
        {"thread": _thread(viewer.user_id, other["user_id"]), "to": viewer.user_id, "read": False},
        {"$set": {"read": True}},
    )
    return {"marked": r.modified_count}


def unread_messages(user_id):
    try:
        return mongo.get_db().messages.count_documents({"to": user_id, "read": False})
    except Exception:
        return 0


# ---------------------------------------------------------------------
# Notifications (computed from PostgreSQL activity)
# ---------------------------------------------------------------------
def _seen_at(user_id):
    try:
        doc = mongo.get_db().user_state.find_one({"user_id": user_id})
        return doc.get("notifications_seen_at") if doc else None
    except Exception:
        return None


def notifications(viewer, limit=40):
    # The viewer's own notifications: who acted on *their* things. These read
    # other people's rows (likes, comments) so they run as the system role,
    # always filtered to the viewer's own entries and lists.
    with db.cursor(system=True) as cur:
        cur.execute(
            """
            SELECT * FROM (
                SELECT 'follow' AS kind, f.created_at AS ts, u.username AS actor,
                       NULL::text AS title, NULL::int AS entry_id, NULL::int AS list_id, NULL::text AS snippet
                FROM user_follow f JOIN users u ON u.user_id = f.follower_id
                WHERE f.followee_id = %(me)s
                UNION ALL
                SELECT 'like_review', rl.created_at, u.username, b.title, d.entry_id, NULL, NULL
                FROM review_like rl JOIN diary_entry d ON d.entry_id = rl.entry_id
                JOIN users u ON u.user_id = rl.user_id JOIN book b ON b.book_id = d.book_id
                WHERE d.user_id = %(me)s AND rl.user_id <> %(me)s
                UNION ALL
                SELECT 'comment_review', c.created_at, u.username, b.title, d.entry_id, NULL, left(c.comment_text, 140)
                FROM comment c JOIN diary_entry d ON d.entry_id = c.entry_id
                JOIN users u ON u.user_id = c.user_id JOIN book b ON b.book_id = d.book_id
                WHERE d.user_id = %(me)s AND c.user_id <> %(me)s
                UNION ALL
                SELECT 'comment_list', c.created_at, u.username, l.name, NULL, l.list_id, left(c.comment_text, 140)
                FROM comment c JOIN list l ON l.list_id = c.list_id JOIN users u ON u.user_id = c.user_id
                WHERE l.user_id = %(me)s AND c.user_id <> %(me)s
                UNION ALL
                SELECT 'like_list', ll.created_at, u.username, l.name, NULL, l.list_id, NULL
                FROM list_like ll JOIN list l ON l.list_id = ll.list_id JOIN users u ON u.user_id = ll.user_id
                WHERE l.user_id = %(me)s AND ll.user_id <> %(me)s
            ) n ORDER BY ts DESC LIMIT %(limit)s
            """,
            {"me": viewer.user_id, "limit": limit},
        )
        rows = cur.fetchall()
    seen = _seen_at(viewer.user_id)
    for r in rows:
        r["unread"] = seen is None or r["ts"] > seen
        r["ts"] = _iso(r["ts"])
    return rows


def unread_notifications(viewer):
    seen = _seen_at(viewer.user_id)
    with db.cursor(system=True) as cur:
        cur.execute(
            """
            SELECT
              (SELECT count(*) FROM user_follow WHERE followee_id = %(me)s AND created_at > %(seen)s)
            + (SELECT count(*) FROM review_like rl JOIN diary_entry d USING (entry_id)
               WHERE d.user_id = %(me)s AND rl.user_id <> %(me)s AND rl.created_at > %(seen)s)
            + (SELECT count(*) FROM comment c LEFT JOIN diary_entry d ON d.entry_id = c.entry_id
               LEFT JOIN list l ON l.list_id = c.list_id
               WHERE coalesce(d.user_id, l.user_id) = %(me)s AND c.user_id <> %(me)s AND c.created_at > %(seen)s)
            + (SELECT count(*) FROM list_like ll JOIN list l USING (list_id)
               WHERE l.user_id = %(me)s AND ll.user_id <> %(me)s AND ll.created_at > %(seen)s) AS n
            """,
            {"me": viewer.user_id, "seen": seen or datetime(1970, 1, 1)},
        )
        return cur.fetchone()["n"]


def mark_notifications_seen(viewer):
    mongo.get_db().user_state.update_one(
        {"user_id": viewer.user_id}, {"$set": {"notifications_seen_at": mongo.now()}}, upsert=True
    )


def pulse(viewer):
    """Polled by the app every ~20 s: marks you online and returns badge counts."""
    touch(viewer.user_id)
    return {"messages": unread_messages(viewer.user_id), "notifications": unread_notifications(viewer)}


# ---------------------------------------------------------------------
# Reading now: what the people you follow have on their nightstand
# ---------------------------------------------------------------------
def reading_now(viewer, limit=24):
    with db.cursor() as cur:
        cur.execute(
            f"""
            SELECT u.username, s.added_at AS since, {BOOK_CARD}
            FROM user_follow f
            JOIN users u ON u.user_id = f.followee_id AND NOT u.is_private
            JOIN shelf s ON s.user_id = u.user_id AND s.status = 'currently_reading'
            JOIN book_summary bs ON bs.book_id = s.book_id
            WHERE f.follower_id = %s
            ORDER BY s.added_at DESC LIMIT %s
            """,
            (viewer.user_id, limit),
        )
        rows = cur.fetchall()
    online = set()
    if rows:
        with db.cursor() as cur:
            cur.execute("SELECT user_id, username FROM users WHERE username = ANY(%s)", ([r["username"] for r in rows],))
            ids = {r["username"]: r["user_id"] for r in cur.fetchall()}
        online_set = online_ids(ids.values())
        online = {u for u, i in ids.items() if i in online_set}
    for r in rows:
        r["since"] = _iso(r["since"])
        r["online"] = r["username"] in online
    return rows


def readers_now(book_id, viewer):
    """How many public readers have this book on their currently-reading shelf, and which of them you follow."""
    with db.cursor(system=True) as cur:
        cur.execute(
            """
            SELECT u.username,
                   EXISTS (SELECT 1 FROM user_follow f WHERE f.follower_id = %(me)s AND f.followee_id = u.user_id) AS followed
            FROM shelf s JOIN users u ON u.user_id = s.user_id AND NOT u.is_private
            WHERE s.book_id = %(book)s AND s.status = 'currently_reading' AND u.user_id <> %(me)s
            ORDER BY followed DESC, s.added_at DESC
            """,
            {"book": book_id, "me": viewer.user_id if viewer else 0},
        )
        rows = cur.fetchall()
    return {"count": len(rows), "friends": [r["username"] for r in rows if r["followed"]][:12],
            "others": [r["username"] for r in rows if not r["followed"]][:12]}
