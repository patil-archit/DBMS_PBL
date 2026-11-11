"""
One-time migration of the old Neo4j data into PostgreSQL.

Run AFTER seed_from_csv.py, with the old Neo4j database running:
    pip install neo4j                       # only needed for this script
    NEO4J_PASSWORD=... backend/venv/bin/python backend/db/migrate_from_neo4j.py

Copies over: books/authors/genres missing from Postgres, author bios,
users (uid, name, friend code), library entries (-> diary_entry),
author follows and user follows. Safe to re-run.
"""
import os
import uuid

import psycopg2
from dotenv import load_dotenv

HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(os.path.dirname(HERE), ".env"))

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/booklog")
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")
NEO4J_DB = os.getenv("NEO4J_DATABASE", "bookgraph")


def get_id(cur, sql, params):
    cur.execute(sql, params)
    row = cur.fetchone()
    return row[0] if row else None


def main():
    from neo4j import GraphDatabase

    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    with driver.session(database=NEO4J_DB) as s:
        books = s.run("""
            MATCH (b:Book)
            OPTIONAL MATCH (b)-[:WRITTEN_BY]->(a:Author)
            OPTIONAL MATCH (b)-[:HAS_CATEGORY]->(c:Category)
            RETURN b {.*} AS b, collect(DISTINCT a.name) AS authors, collect(DISTINCT c.name) AS genres
        """).data()
        authors = s.run("MATCH (a:Author) RETURN a.name AS name, a.description AS bio").data()
        users = s.run("MATCH (u:User) RETURN u.uid AS uid, u.name AS name, u.friend_code AS code").data()
        library = s.run("""
            MATCH (u:User)-[r:ADDED_TO_LIBRARY]->(b:Book)
            RETURN u.uid AS uid, b.title AS title, r.rating AS rating, r.review AS review,
                   toString(r.timestamp) AS ts
        """).data()
        author_follows = s.run("MATCH (u:User)-[:FOLLOWS]->(a:Author) RETURN u.uid AS uid, a.name AS name").data()
        user_follows = s.run("MATCH (u:User)-[:FOLLOWS_USER]->(v:User) RETURN u.uid AS a, v.uid AS b").data()
    driver.close()

    conn = psycopg2.connect(DATABASE_URL)
    with conn, conn.cursor() as cur:
        for row in books:
            b = row["b"]
            book_id = get_id(cur, """
                INSERT INTO book (title, subtitle, isbn, description, pub_year, page_count,
                                  avg_rating, ratings_count, cover_url)
                VALUES (%s, %s, NULLIF(%s, ''), %s, %s, NULLIF(%s, 0), %s, %s, NULLIF(%s, ''))
                ON CONFLICT DO NOTHING RETURNING book_id
            """, (b.get("title"), b.get("subtitle") or None, str(b.get("isbn13") or ""),
                  b.get("description"), int(b.get("published_year") or 0) or None,
                  int(b.get("num_pages") or 0), min(float(b.get("average_rating") or 0), 5.0),
                  int(b.get("ratings_count") or 0), b.get("thumbnail") or ""))
            if not book_id:
                continue
            for name in row["authors"]:
                aid = get_id(cur, "INSERT INTO author (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING author_id", (name,))
                cur.execute("INSERT INTO book_author VALUES (%s, %s) ON CONFLICT DO NOTHING", (aid, book_id))
            for name in row["genres"]:
                gid = get_id(cur, "INSERT INTO genre (name) VALUES (%s) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING genre_id", (name,))
                cur.execute("INSERT INTO book_genre VALUES (%s, %s) ON CONFLICT DO NOTHING", (gid, book_id))

        for a in authors:
            cur.execute("""
                INSERT INTO author (name, bio) VALUES (%s, %s)
                ON CONFLICT (name) DO UPDATE SET bio = COALESCE(EXCLUDED.bio, author.bio)
            """, (a["name"], a["bio"]))

        for u in users:
            if not u["uid"]:
                continue
            cur.execute("""
                INSERT INTO users (firebase_uid, friend_code, username) VALUES (%s, %s, %s)
                ON CONFLICT (firebase_uid) DO NOTHING
            """, (u["uid"], u["code"] or uuid.uuid4().hex[:8], u["name"] or "Reader"))

        for e in library:
            rating = e["rating"]
            rating = min(max(round(float(rating) * 2) / 2, 0.5), 5) if rating else None
            cur.execute("""
                INSERT INTO diary_entry (user_id, book_id, rating, review_text, created_at)
                SELECT u.user_id, b.book_id, %s, %s, COALESCE(%s::timestamptz, now())
                FROM users u, book b
                WHERE u.firebase_uid = %s AND b.title = %s
                  AND NOT EXISTS (SELECT 1 FROM diary_entry d
                                  WHERE d.user_id = u.user_id AND d.book_id = b.book_id)
            """, (rating, e["review"], e["ts"], e["uid"], e["title"]))

        for f in author_follows:
            cur.execute("""
                INSERT INTO author_follow (user_id, author_id)
                SELECT u.user_id, a.author_id FROM users u, author a
                WHERE u.firebase_uid = %s AND a.name = %s
                ON CONFLICT DO NOTHING
            """, (f["uid"], f["name"]))

        for f in user_follows:
            cur.execute("""
                INSERT INTO user_follow (follower_id, followee_id)
                SELECT a.user_id, b.user_id FROM users a, users b
                WHERE a.firebase_uid = %s AND b.firebase_uid = %s AND a.user_id <> b.user_id
                ON CONFLICT DO NOTHING
            """, (f["a"], f["b"]))
    conn.close()
    print(f"Migrated {len(users)} users, {len(library)} library entries, "
          f"{len(author_follows)} author follows, {len(user_follows)} user follows.")


if __name__ == "__main__":
    main()
