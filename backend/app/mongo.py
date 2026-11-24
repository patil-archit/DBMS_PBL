"""
MongoDB: document data that doesn't need relational guarantees.

Collections
  activity_logs          views / searches / clicks (used for trending books)
  chat_sessions          chatbot conversations, one document per conversation
  saved_recommendations  cached recommendation lists; a TTL index deletes them after 1 hour
  book_takes             short notes on books for the Flips feed, public (private accounts: followers only)
  messages               direct messages between readers who follow each other
  presence               last time each reader was active ("online now")
  user_state             per-reader settings such as when notifications were last read

If MongoDB is down, logging is skipped and readers fall back gracefully.
"""
import os
from datetime import datetime, timedelta, timezone

from pymongo import ASCENDING, DESCENDING, MongoClient

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "booklog")
RECOMMENDATION_TTL_SECONDS = 3600

_client = None


def get_db():
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=int(os.getenv("MONGO_TIMEOUT_MS", "5000")), connectTimeoutMS=5000, tz_aware=True)
    return _client[MONGO_DB]


def ensure_indexes():
    try:
        mdb = get_db()
        mdb.activity_logs.create_index([("ts", DESCENDING)])
        mdb.activity_logs.create_index([("type", ASCENDING), ("book_id", ASCENDING), ("ts", DESCENDING)])
        mdb.activity_logs.create_index([("user_id", ASCENDING), ("ts", DESCENDING)])
        mdb.chat_sessions.create_index([("user_id", ASCENDING), ("updated_at", DESCENDING)])
        mdb.saved_recommendations.create_index("created_at", expireAfterSeconds=RECOMMENDATION_TTL_SECONDS)
        mdb.saved_recommendations.create_index("user_id", unique=True)
        mdb.book_takes.create_index([("book_id", ASCENDING), ("created_at", DESCENDING)])
        mdb.book_takes.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
        mdb.messages.create_index([("thread", ASCENDING), ("created_at", DESCENDING)])
        mdb.messages.create_index([("to", ASCENDING), ("read", ASCENDING)])
        mdb.presence.create_index("user_id", unique=True)
        mdb.user_state.create_index("user_id", unique=True)
        return True
    except Exception as e:
        print(f"MongoDB not available: {e}")
        return False


def now():
    return datetime.now(timezone.utc)


def log_activity(kind: str, user_id=None, book_id=None, query=None, source=None):
    """kind: 'view' | 'search' | 'click'. Never raises."""
    try:
        get_db().activity_logs.insert_one({
            "type": kind, "user_id": user_id or None, "book_id": book_id,
            "query": query, "source": source, "ts": now(),
        })
    except Exception:
        pass


def trending_book_ids(days: int = 7, limit: int = 12):
    """Most viewed/clicked books in the last `days` days. Returns [(book_id, score)]."""
    try:
        pipeline = [
            {"$match": {"type": {"$in": ["view", "click"]}, "book_id": {"$ne": None},
                        "ts": {"$gte": now() - timedelta(days=days)}}},
            {"$group": {"_id": "$book_id",
                        "score": {"$sum": {"$cond": [{"$eq": ["$type", "click"]}, 2, 1]}},
                        "users": {"$addToSet": "$user_id"}}},
            {"$sort": {"score": -1}},
            {"$limit": limit},
        ]
        return [(d["_id"], d["score"]) for d in get_db().activity_logs.aggregate(pipeline)]
    except Exception:
        return []


def get_cached_recommendations(user_id: int):
    try:
        doc = get_db().saved_recommendations.find_one({"user_id": user_id})
        return doc["items"] if doc else None
    except Exception:
        return None


def save_recommendations(user_id: int, items):
    try:
        get_db().saved_recommendations.replace_one(
            {"user_id": user_id}, {"user_id": user_id, "items": items, "created_at": now()}, upsert=True
        )
    except Exception:
        pass


def clear_recommendations(user_id: int):
    try:
        get_db().saved_recommendations.delete_one({"user_id": user_id})
    except Exception:
        pass


def delete_user_data(user_id: int):
    """Used by the sync worker when an account is deleted. Raises on failure so it is retried."""
    mdb = get_db()
    mdb.activity_logs.delete_many({"user_id": user_id})
    mdb.chat_sessions.delete_many({"user_id": user_id})
    mdb.saved_recommendations.delete_many({"user_id": user_id})
    mdb.book_takes.delete_many({"user_id": user_id})
    mdb.book_takes.update_many({"likes": user_id}, {"$pull": {"likes": user_id}})
    mdb.messages.delete_many({"$or": [{"from": user_id}, {"to": user_id}]})
    mdb.presence.delete_many({"user_id": user_id})
    mdb.user_state.delete_many({"user_id": user_id})
