"""
Rebuilds the Neo4j social graph from PostgreSQL (the source of truth).

Normally the API's sync worker keeps Neo4j up to date through the
sync_outbox table; run this after restoring a backup or if Neo4j was wiped.

    backend/venv/bin/python backend/db/sync_neo4j.py
"""
import os
import sys

from dotenv import load_dotenv

HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(os.path.dirname(HERE), ".env"))
sys.path.insert(0, os.path.dirname(HERE))

from app import graph  # noqa: E402
from app.database import db  # noqa: E402


def main():
    graph.ensure_constraints()
    graph.run("MATCH (n) DETACH DELETE n")
    with db.cursor(system=True) as cur:
        cur.execute("SELECT user_id, username FROM users")
        users = cur.fetchall()
        cur.execute("SELECT follower_id, followee_id FROM user_follow")
        follows = cur.fetchall()
        cur.execute(
            """
            SELECT DISTINCT ON (d.user_id, d.book_id) d.user_id, d.book_id, b.title,
                   (SELECT d2.rating FROM diary_entry d2 WHERE d2.user_id = d.user_id AND d2.book_id = d.book_id
                      AND d2.rating IS NOT NULL ORDER BY d2.created_at DESC LIMIT 1) AS rating,
                   (SELECT bool_or(d2.is_liked) FROM diary_entry d2 WHERE d2.user_id = d.user_id AND d2.book_id = d.book_id) AS liked
            FROM diary_entry d JOIN book b USING (book_id)
            """
        )
        reads = cur.fetchall()
        # everything up to now is reflected; don't replay old outbox rows
        cur.execute("UPDATE sync_outbox SET done_at = now() WHERE done_at IS NULL")

    graph.run("UNWIND $rows AS r MERGE (u:User {user_id: r.user_id}) SET u.username = r.username", rows=users)
    graph.run("""UNWIND $rows AS r
                 MATCH (a:User {user_id: r.follower_id}), (b:User {user_id: r.followee_id})
                 MERGE (a)-[:FOLLOWS]->(b)""", rows=follows)
    graph.run("""UNWIND $rows AS r
                 MATCH (u:User {user_id: r.user_id})
                 MERGE (b:Book {book_id: r.book_id}) SET b.title = r.title
                 MERGE (u)-[x:RATED]->(b) SET x.rating = r.rating, x.liked = r.liked""",
              rows=[{**r, "rating": float(r["rating"]) if r["rating"] is not None else None} for r in reads])
    print(f"Neo4j rebuilt: {len(users)} users, {len(follows)} follows, {len(reads)} read edges")


if __name__ == "__main__":
    main()
