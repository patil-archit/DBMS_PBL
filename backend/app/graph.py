"""
Neo4j: the social reading graph.

    (:User {user_id, username})-[:FOLLOWS]->(:User)
    (:User)-[:RATED {rating, liked}]->(:Book {book_id, title})

PostgreSQL is the source of truth. Changes reach Neo4j through the
sync_outbox table (see app/sync_worker.py). These queries answer the
network questions: people you may know, steps apart, taste match, and
readers with similar taste.
"""
import os

from neo4j import GraphDatabase

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

_driver = None


class GraphUnavailable(Exception):
    pass


def driver():
    global _driver
    if _driver is None:
        _driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD),
                                       connection_timeout=3, max_transaction_retry_time=3,
                                       notifications_min_severity="OFF")
    return _driver


def run(query, **params):
    try:
        with driver().session(database=NEO4J_DATABASE) as session:
            return session.run(query, **params).data()
    except Exception as e:
        raise GraphUnavailable(str(e)) from e


def ensure_constraints():
    try:
        run("CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.user_id IS UNIQUE")
        run("CREATE CONSTRAINT book_id IF NOT EXISTS FOR (b:Book) REQUIRE b.book_id IS UNIQUE")
        return True
    except GraphUnavailable as e:
        print(f"Neo4j not available: {e}")
        return False


# ---------------------------------------------------------------------
# Writes (called by the sync worker)
# ---------------------------------------------------------------------
def upsert_user(user_id, username):
    run("MERGE (u:User {user_id: $id}) SET u.username = $username", id=user_id, username=username)


def delete_user(user_id):
    run("MATCH (u:User {user_id: $id}) DETACH DELETE u", id=user_id)


def follow(follower_id, followee_id):
    run("""
        MERGE (a:User {user_id: $a}) MERGE (b:User {user_id: $b})
        MERGE (a)-[:FOLLOWS]->(b)
    """, a=follower_id, b=followee_id)


def unfollow(follower_id, followee_id):
    run("MATCH (:User {user_id: $a})-[r:FOLLOWS]->(:User {user_id: $b}) DELETE r",
        a=follower_id, b=followee_id)


def set_read(user_id, book_id, title, rating, liked):
    """rating None + liked None means the user has no diary entries left for the book."""
    if rating is None and liked is None:
        run("MATCH (:User {user_id: $u})-[r:RATED]->(:Book {book_id: $b}) DELETE r", u=user_id, b=book_id)
        return
    run("""
        MERGE (u:User {user_id: $u})
        MERGE (b:Book {book_id: $b}) SET b.title = $title
        MERGE (u)-[r:RATED]->(b) SET r.rating = $rating, r.liked = $liked
    """, u=user_id, b=book_id, title=title, rating=rating, liked=liked)


# ---------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------
def people_you_may_know(user_id, limit=8):
    """Friends of friends I don't follow yet, ranked by mutual connections."""
    return run("""
        MATCH (me:User {user_id: $me})-[:FOLLOWS]->(f:User)-[:FOLLOWS]->(fof:User)
        WHERE fof <> me AND NOT (me)-[:FOLLOWS]->(fof)
        RETURN fof.user_id AS user_id, fof.username AS username,
               count(DISTINCT f) AS mutual, collect(DISTINCT f.username)[..3] AS via
        ORDER BY mutual DESC, username LIMIT $limit
    """, me=user_id, limit=limit)


def steps_apart(a, b, max_depth=6):
    """Length of the shortest follow path in either direction, or None."""
    if a == b:
        return 0
    rows = run(f"""
        MATCH (a:User {{user_id: $a}}), (b:User {{user_id: $b}})
        MATCH p = shortestPath((a)-[:FOLLOWS*..{int(max_depth)}]-(b))
        RETURN length(p) AS steps
    """, a=a, b=b)
    return rows[0]["steps"] if rows else None


def taste_match(a, b):
    """
    Taste match between two readers:
      agreement = average over books both rated of 1 - |r1 - r2| / 4.5
      overlap   = shared books / books either rated  (Jaccard)
      match %   = 100 * (0.7 * agreement + 0.3 * overlap)
    """
    rows = run("""
        MATCH (a:User {user_id: $a}), (b:User {user_id: $b})
        OPTIONAL MATCH (a)-[ra:RATED]->(x:Book)<-[rb:RATED]-(b)
        WITH a, b, collect({ra: ra.rating, rb: rb.rating}) AS pairs, count(x) AS shared
        OPTIONAL MATCH (a)-[:RATED]->(ba:Book)
        WITH a, b, pairs, shared, count(DISTINCT ba) AS na
        OPTIONAL MATCH (b)-[:RATED]->(bb:Book)
        RETURN pairs, shared, na, count(DISTINCT bb) AS nb
    """, a=a, b=b)
    if not rows:
        return {"match_percent": 0, "shared_books": 0}
    r = rows[0]
    shared = r["shared"]
    if shared == 0:
        return {"match_percent": 0, "shared_books": 0}
    rated = [p for p in r["pairs"] if p["ra"] is not None and p["rb"] is not None]
    agreement = (sum(1 - abs(p["ra"] - p["rb"]) / 4.5 for p in rated) / len(rated)) if rated else 0.5
    union = r["na"] + r["nb"] - shared
    overlap = shared / union if union else 0
    return {"match_percent": round(100 * (0.7 * agreement + 0.3 * overlap)), "shared_books": shared}


def similar_taste_books(user_id, limit=10):
    """
    Readers who rated at least one book like me (within 1 star) and the books
    they rated 4+ that I haven't logged. Score = number of such readers.
    """
    return run("""
        MATCH (me:User {user_id: $me})-[r1:RATED]->(:Book)<-[r2:RATED]-(other:User)
        WHERE other <> me AND r1.rating IS NOT NULL AND r2.rating IS NOT NULL
          AND abs(r1.rating - r2.rating) <= 1
        WITH me, other, count(*) AS agreements
        MATCH (other)-[r:RATED]->(rec:Book)
        WHERE r.rating >= 4 AND NOT (me)-[:RATED]->(rec)
        RETURN rec.book_id AS book_id, count(DISTINCT other) AS readers, sum(agreements) AS strength
        ORDER BY readers DESC, strength DESC LIMIT $limit
    """, me=user_id, limit=limit)
