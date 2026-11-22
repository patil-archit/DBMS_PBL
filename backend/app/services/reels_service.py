"""
Reels: a vertical, one-book-per-screen feed with "takes".

A take is a short note about a book (a fun fact, a hot take, a mood) stored as
a document in MongoDB (`book_takes`). Who may see a take comes from the follow
graph in PostgreSQL (`user_follow`): the author and the people who follow the
author. Book data always comes from PostgreSQL.
"""
import random
from datetime import datetime

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException

from app import mongo
from app.database import db
from app.services.discover_service import CARD

VIBES = ["fun_fact", "must_read", "cried", "mind_blown", "slow_start", "overrated", "comfort", "quote"]
MAX_TAKES_PER_REEL = 30


def _audience(viewer):
    """User ids whose takes this viewer may see: themselves and everyone they follow."""
    if viewer is None:
        return []
    with db.cursor() as cur:
        cur.execute("SELECT followee_id FROM user_follow WHERE follower_id = %s", (viewer.user_id,))
        return [viewer.user_id] + [r["followee_id"] for r in cur.fetchall()]


def _books(ids):
    if not ids:
        return {}
    with db.cursor() as cur:
        cur.execute(f"SELECT {CARD} FROM book_summary bs WHERE bs.book_id = ANY(%s)", (list(ids),))
        return {r["book_id"]: r for r in cur.fetchall()}


def _public(doc, viewer):
    ts = doc["created_at"]
    return {
        "take_id": str(doc["_id"]),
        "book_id": doc["book_id"],
        "username": doc["username"],
        "text": doc["text"],
        "vibe": doc.get("vibe"),
        "created_at": ts.isoformat() if isinstance(ts, datetime) else ts,
        "likes": len(doc.get("likes", [])),
        "liked": bool(viewer and viewer.user_id in doc.get("likes", [])),
        "mine": bool(viewer and doc["user_id"] == viewer.user_id),
    }


def _takes_for(book_ids, audience, viewer):
    """Visible takes grouped by book: {book_id: [take, ...]} newest first."""
    out = {b: [] for b in book_ids}
    if not audience or not book_ids:
        return out
    try:
        cursor = mongo.get_db().book_takes.find(
            {"book_id": {"$in": list(book_ids)}, "user_id": {"$in": audience}}
        ).sort("created_at", -1)
        for d in cursor:
            if len(out[d["book_id"]]) < MAX_TAKES_PER_REEL:
                out[d["book_id"]].append(_public(d, viewer))
    except Exception:
        pass  # MongoDB down: reels still work, just without takes
    return out


def _reels(ids, viewer, audience=None):
    books = _books(ids)
    audience = _audience(viewer) if audience is None else audience
    takes = _takes_for([i for i in ids if i in books], audience, viewer)
    return [{"book": books[i], "takes": takes[i]} for i in ids if i in books]


def feed(viewer, mode="for_you", limit=8, genre=None):
    """
    for_you   : well-rated books picked at random (optionally in a genre)
    following : books the people you follow have posted takes about, newest first
    """
    if mode == "following":
        audience = _audience(viewer)
        if not audience:
            return []
        try:
            pipeline = [
                {"$match": {"user_id": {"$in": audience}}},
                {"$group": {"_id": "$book_id", "last": {"$max": "$created_at"}}},
                {"$sort": {"last": -1}},
                {"$limit": 60},
            ]
            ids = [d["_id"] for d in mongo.get_db().book_takes.aggregate(pipeline)]
        except Exception:
            return []
        return _reels(ids, viewer, audience)

    where, params = ["bs.avg_rating >= 3.6", "bs.ratings_count >= 10", "bs.cover_url IS NOT NULL"], []
    if genre:
        where.append("%s = ANY(bs.genres)")
        params.append(genre)
    sql_where = " AND ".join(where)
    with db.cursor() as cur:
        # A fresh random order every request (hash of id + seed), then one book per author
        cur.execute(
            f"""SELECT bs.book_id, bs.authors[1] AS author FROM book_summary bs WHERE {sql_where}
                ORDER BY md5(bs.book_id::text || %s) LIMIT %s""",
            params + [str(random.random()), limit * 4],
        )
        rows = cur.fetchall()
    ids, authors = [], set()
    for r in rows:
        if r["author"] in authors:
            continue
        authors.add(r["author"])
        ids.append(r["book_id"])
    return _reels(ids[:limit], viewer)


def book_takes(book_id, viewer):
    return _takes_for([book_id], _audience(viewer), viewer)[book_id]


def post_take(viewer, book_id, text, vibe=None):
    text = (text or "").strip()
    if not 1 <= len(text) <= 280:
        raise HTTPException(422, "A take is 1 to 280 characters")
    if vibe is not None and vibe not in VIBES:
        raise HTTPException(422, f"vibe must be one of {', '.join(VIBES)}")
    if not _books([book_id]):
        raise HTTPException(404, "Book not found")
    doc = {
        "book_id": book_id, "user_id": viewer.user_id, "username": viewer.username,
        "text": text, "vibe": vibe, "likes": [], "created_at": mongo.now(),
    }
    try:
        doc["_id"] = mongo.get_db().book_takes.insert_one(doc).inserted_id
    except Exception:
        raise HTTPException(503, "Takes are unavailable right now (MongoDB)")
    mongo.log_activity("take", viewer.user_id, book_id)
    return _public(doc, viewer)


def _get(take_id):
    try:
        oid = ObjectId(take_id)
    except (InvalidId, TypeError):
        raise HTTPException(404, "Take not found")
    doc = mongo.get_db().book_takes.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, "Take not found")
    return doc


def toggle_like(viewer, take_id):
    doc = _get(take_id)
    if doc["user_id"] not in _audience(viewer):
        raise HTTPException(404, "Take not found")  # not visible to you
    liked = viewer.user_id in doc.get("likes", [])
    mongo.get_db().book_takes.update_one(
        {"_id": doc["_id"]}, {"$pull" if liked else "$addToSet": {"likes": viewer.user_id}}
    )
    return {"liked": not liked, "likes": len(doc.get("likes", [])) + (-1 if liked else 1)}


def delete_take(viewer, take_id):
    doc = _get(take_id)
    if doc["user_id"] != viewer.user_id and not viewer.is_staff:
        raise HTTPException(403, "You can only delete your own takes")
    mongo.get_db().book_takes.delete_one({"_id": doc["_id"]})
