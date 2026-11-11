"""
Keeps Neo4j and MongoDB consistent with PostgreSQL.

PostgreSQL triggers write every relevant change into `sync_outbox` in the
same transaction as the change itself. This worker reads pending rows in
order, applies them, and marks them done. If Neo4j or MongoDB is down the
row stays pending (attempts / last_error are recorded) and is retried on the
next pass, so the stores always converge.
"""
import threading
import time

from app import graph, mongo
from app.database import db

POLL_SECONDS = 2
BATCH = 200

_stop = threading.Event()
_thread = None


def _apply(target, op, p):
    if target == "neo4j":
        if op == "upsert_user":
            graph.upsert_user(p["user_id"], p["username"])
        elif op == "delete_user":
            graph.delete_user(p["user_id"])
        elif op == "follow":
            graph.follow(p["follower_id"], p["followee_id"])
        elif op == "unfollow":
            graph.unfollow(p["follower_id"], p["followee_id"])
        elif op == "refresh_read":
            # Read the user's current state for this book from PostgreSQL (source of truth)
            with db.cursor(system=True) as cur:
                cur.execute(
                    """
                    SELECT b.title,
                           (SELECT d.rating FROM diary_entry d
                            WHERE d.user_id = %(u)s AND d.book_id = b.book_id AND d.rating IS NOT NULL
                            ORDER BY d.created_at DESC LIMIT 1) AS rating,
                           (SELECT bool_or(d.is_liked) FROM diary_entry d
                            WHERE d.user_id = %(u)s AND d.book_id = b.book_id) AS liked
                    FROM book b WHERE b.book_id = %(b)s
                    """,
                    {"u": p["user_id"], "b": p["book_id"]},
                )
                row = cur.fetchone()
            if row:
                graph.set_read(p["user_id"], p["book_id"], row["title"], row["rating"], row["liked"])
            else:
                graph.set_read(p["user_id"], p["book_id"], None, None, None)
        else:
            raise ValueError(f"unknown neo4j op {op}")
    elif target == "mongo":
        if op == "delete_user":
            mongo.delete_user_data(p["user_id"])
        else:
            raise ValueError(f"unknown mongo op {op}")


def process_once() -> int:
    """Applies pending outbox rows in order. Returns how many were applied."""
    with db.cursor(system=True) as cur:
        cur.execute(
            """
            SELECT id, target, op, payload FROM sync_outbox
            WHERE done_at IS NULL ORDER BY id LIMIT %s
            """,
            (BATCH,),
        )
        rows = cur.fetchall()

    applied = 0
    failed_targets = set()
    for row in rows:
        if row["target"] in failed_targets:
            continue  # keep per-target order: retry this target next pass
        try:
            _apply(row["target"], row["op"], row["payload"])
            with db.cursor(system=True) as cur:
                cur.execute("UPDATE sync_outbox SET done_at = now(), last_error = NULL WHERE id = %s", (row["id"],))
            applied += 1
        except Exception as e:
            failed_targets.add(row["target"])
            with db.cursor(system=True) as cur:
                cur.execute(
                    "UPDATE sync_outbox SET attempts = attempts + 1, last_error = %s WHERE id = %s",
                    (str(e)[:500], row["id"]),
                )
    return applied


def _loop():
    while not _stop.is_set():
        try:
            process_once()
        except Exception as e:
            print(f"sync worker error: {e}")
        _stop.wait(POLL_SECONDS)


def start():
    global _thread
    if _thread is None or not _thread.is_alive():
        _stop.clear()
        _thread = threading.Thread(target=_loop, name="sync-worker", daemon=True)
        _thread.start()


def stop():
    _stop.set()


def status():
    with db.cursor(system=True) as cur:
        cur.execute(
            """
            SELECT target,
                   count(*) FILTER (WHERE done_at IS NULL) AS pending,
                   count(*) FILTER (WHERE done_at IS NULL AND attempts > 0) AS failing,
                   max(last_error) FILTER (WHERE done_at IS NULL) AS last_error
            FROM sync_outbox GROUP BY target
            """
        )
        return cur.fetchall()
