import time
import os
import glob
import re
from app.database import db

# Memory cache for fast BMH search candidates
_search_index = None
_last_indexed = 0
INDEX_TTL = 300 # 5 minutes

def get_actual_image_url(author_name: str) -> str:
    """
    Checks the local frontend/public/authors/ directory at runtime for files matching
    the author's name with ANY extension (png, jpg, jpeg, webp, avif, svg).
    Returns the correct local path with matching extension, or falls back to .jpg.
    """
    # Normalize author name to filename format (e.g., "J.K. Rowling" -> "jk_rowling")
    safe_name = author_name.lower()
    safe_name = re.sub(r'[^a-z0-9\s]', '', safe_name)
    safe_name = "_".join(safe_name.split())
    
    # Path to frontend public directory
    public_authors_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
        "frontend", "public", "authors"
    )
    
    # Look for files named "safe_name.*" in that directory
    search_pattern = os.path.join(public_authors_dir, f"{safe_name}.*")
    matching_files = glob.glob(search_pattern)
    
    if matching_files:
        # Resolve to the first matching file's extension
        first_file = matching_files[0]
        ext = os.path.splitext(first_file)[1]
        return f"/authors/{safe_name}{ext}"
        
    # Fallback default path if no custom file exists
    return f"/authors/{safe_name}.jpg"

def get_all_searchable_nodes():
    """
    Retrieves all Books, Authors, and Categories from the database to build a memory index.
    Includes simple caching.
    """
    global _search_index, _last_indexed
    now = time.time()
    
    if _search_index is not None and (now - _last_indexed) < INDEX_TTL:
        return _search_index

    # 1. Fetch Books
    books_query = """
    MATCH (b:Book)
    OPTIONAL MATCH (b)-[:WRITTEN_BY]->(a:Author)
    OPTIONAL MATCH (b)-[:HAS_CATEGORY]->(c:Category)
    RETURN b.title AS title,
           b.subtitle AS subtitle,
           b.thumbnail AS thumbnail,
           b.average_rating AS average_rating,
           b.description AS description,
           collect(DISTINCT a.name) AS authors,
           collect(DISTINCT c.name) AS categories
    """
    
    # 2. Fetch Authors
    authors_query = """
    MATCH (a:Author)
    OPTIONAL MATCH (b:Book)-[:WRITTEN_BY]->(a)
    RETURN a.name AS name,
           a.description AS description,
           a.image_url AS image_url,
           count(b) AS book_count
    """
    
    # 3. Fetch Categories
    categories_query = """
    MATCH (c:Category)
    OPTIONAL MATCH (b:Book)-[:HAS_CATEGORY]->(c)
    RETURN c.name AS name,
           count(b) AS book_count
    """
    
    with db.get_session() as session:
        books_res = session.run(books_query)
        books = [record.data() for record in books_res]
        
        authors_res = session.run(authors_query)
        authors = []
        for record in authors_res:
            a_data = record.data()
            # Dynamically resolve file extensions for search candidates
            a_data["image_url"] = get_actual_image_url(a_data["name"])
            authors.append(a_data)
        
        categories_res = session.run(categories_query)
        categories = [record.data() for record in categories_res]
        
    _search_index = {
        "books": books,
        "authors": authors,
        "categories": categories
    }
    _last_indexed = now
    return _search_index

def invalidate_search_cache():
    """Invalidates the search cache so the next search will fetch fresh database nodes."""
    global _search_index
    _search_index = None

def get_author_details(name: str, user_uid: str = None):
    """
    Performs deep graph traversals to return a detailed biography,
    follow status, co-authors list, and rating metrics for a given author.
    """
    # 1. Fetch main author details & follow status
    author_query = """
    MATCH (a:Author {name: $name})
    OPTIONAL MATCH (u:User {uid: $uid})-[:FOLLOWS]->(a)
    RETURN a.name AS name,
           a.description AS description,
           a.image_url AS image_url,
           u IS NOT NULL AS is_followed
    """
    
    # 2. Fetch statistical report of author's books
    stats_query = """
    MATCH (a:Author {name: $name})<-[:WRITTEN_BY]-(b:Book)
    RETURN count(b) AS total_books,
           coalesce(avg(b.average_rating), 0.0) AS avg_rating,
           coalesce(sum(b.ratings_count), 0) AS total_ratings,
           coalesce(sum(b.num_pages), 0) AS total_pages
    """
    
    # 3. Fetch primary genres (categories)
    genres_query = """
    MATCH (a:Author {name: $name})<-[:WRITTEN_BY]-(b:Book)-[:HAS_CATEGORY]->(c:Category)
    RETURN c.name AS genre, count(b) AS book_count
    ORDER BY book_count DESC
    """
    
    # 4. Fetch all books written by author
    books_query = """
    MATCH (a:Author {name: $name})<-[:WRITTEN_BY]-(b:Book)
    OPTIONAL MATCH (b)-[:HAS_CATEGORY]->(c:Category)
    RETURN b.title AS title,
           b.subtitle AS subtitle,
           b.thumbnail AS thumbnail,
           b.average_rating AS average_rating,
           collect(DISTINCT a.name) AS authors,
           collect(DISTINCT c.name) AS categories
    ORDER BY b.average_rating DESC
    """
    
    # 5. Fetch co-authors and related authors based on category overlap
    co_authors_query = """
    MATCH (a:Author {name: $name})<-[:WRITTEN_BY]-(b:Book)-[:HAS_CATEGORY]->(c:Category)<-[:HAS_CATEGORY]-(ob:Book)-[:WRITTEN_BY]->(oa:Author)
    WHERE a <> oa
    RETURN oa.name AS name,
           count(DISTINCT ob) AS shared_books,
           collect(DISTINCT c.name) AS shared_genres
    ORDER BY shared_books DESC
    LIMIT 5
    """
    
    with db.get_session() as session:
        # Check author existence
        author_res = session.run(author_query, parameters={"name": name, "uid": user_uid or ""})
        author_record = author_res.single()
        if not author_record:
            return None
        
        author_data = author_record.data()
        # Dynamically check and resolve actual uploaded file extension
        author_data["image_url"] = get_actual_image_url(author_data["name"])
        
        # Stats
        stats_res = session.run(stats_query, parameters={"name": name})
        stats_record = stats_res.single()
        stats_data = stats_record.data() if stats_record else {"total_books": 0, "avg_rating": 0.0, "total_ratings": 0, "total_pages": 0}
        
        # Genres
        genres_res = session.run(genres_query, parameters={"name": name})
        genres_list = [record["genre"] for record in genres_res]
        
        # Books
        books_res = session.run(books_query, parameters={"name": name})
        books_list = [record.data() for record in books_res]
        
        # Co-authors
        co_res = session.run(co_authors_query, parameters={"name": name})
        co_list = []
        for record in co_res:
            co_list.append({
                "name": record["name"],
                "shared_books": record["shared_books"],
                "shared_genres": list(record["shared_genres"])
            })
            
    return {
        "name": author_data["name"],
        "description": author_data["description"],
        "image_url": author_data["image_url"],
        "is_followed": author_data["is_followed"],
        "stats": {
            "total_books": stats_data["total_books"],
            "avg_rating": round(stats_data["avg_rating"], 2),
            "total_ratings": stats_data["total_ratings"],
            "total_pages": stats_data["total_pages"]
        },
        "genres": genres_list,
        "books": books_list,
        "co_authors": co_list
    }

def follow_author(uid: str, author_name: str) -> bool:
    """Creates a directed FOLLOWS relationship in Neo4j."""
    cypher_query = """
    MERGE (u:User {uid: $uid})
    WITH u
    MATCH (a:Author {name: $author_name})
    MERGE (u)-[:FOLLOWS]->(a)
    RETURN a
    """
    with db.get_session() as session:
        result = session.run(cypher_query, parameters={"uid": uid, "author_name": author_name})
        return result.single() is not None

def unfollow_author(uid: str, author_name: str) -> bool:
    """Deletes a FOLLOWS relationship in Neo4j."""
    cypher_query = """
    MATCH (u:User {uid: $uid})-[r:FOLLOWS]->(a:Author {name: $author_name})
    DELETE r
    RETURN a
    """
    with db.get_session() as session:
        result = session.run(cypher_query, parameters={"uid": uid, "author_name": author_name})
        return result.single() is not None

# =====================================================================
# EXISTING PHASE 1 FUNCTIONS PRESERVED FOR FULL BACKWARD COMPATIBILITY
# =====================================================================

def search_books(query: str):
    cypher_query = """
    MATCH (b:Book)
    WHERE toLower(b.title) CONTAINS toLower($search_term)
    OPTIONAL MATCH (b)-[:WRITTEN_BY]->(a:Author)
    OPTIONAL MATCH (b)-[:HAS_CATEGORY]->(c:Category)
    RETURN b.title AS title,
           b.thumbnail AS thumbnail,
           b.average_rating AS average_rating,
           collect(DISTINCT a.name) AS authors,
           collect(DISTINCT c.name) AS categories
    ORDER BY b.average_rating DESC
    LIMIT 20
    """
    with db.get_session() as session:
        result = session.run(cypher_query, parameters={"search_term": query})
        return [record.data() for record in result]

def get_book_details(title: str, uid: str = None):
    cypher_query = """
    MATCH (b:Book {title: $title})
    OPTIONAL MATCH (b)-[:WRITTEN_BY]->(a:Author)
    OPTIONAL MATCH (b)-[:HAS_CATEGORY]->(c:Category)
    
    // Check if the user has already added the book to library
    OPTIONAL MATCH (u:User {uid: $uid})-[r:ADDED_TO_LIBRARY]->(b)
    
    RETURN b.title AS title,
           b.subtitle AS subtitle,
           b.description AS description,
           b.thumbnail AS thumbnail,
           b.published_year AS published_year,
           b.average_rating AS average_rating,
           b.num_pages AS num_pages,
           b.ratings_count AS ratings_count,
           b.isbn13 AS isbn13,
           b.isbn10 AS isbn10,
           collect(DISTINCT a.name) AS authors,
           collect(DISTINCT c.name) AS categories,
           r IS NOT NULL AS in_library
    """
    with db.get_session() as session:
        result = session.run(cypher_query, parameters={"title": title, "uid": uid or ""})
        record = result.single()
        if record:
            return record.data()
        return None

def get_recommendations(title: str):
    cypher_query = """
    MATCH (b:Book {title: $title})-[:HAS_CATEGORY]->(c:Category)<-[:HAS_CATEGORY]-(rec:Book)
    WHERE b <> rec
    WITH rec, collect(DISTINCT c.name) AS shared_categories
    WITH rec, 
         size(shared_categories) AS category_overlap,
         coalesce(toFloat(rec.average_rating), 0.0) AS avg_rating,
         coalesce(toFloat(rec.ratings_count), 0.0) AS popularity
    WITH rec, category_overlap, avg_rating, popularity,
         (5 * category_overlap + 3 * avg_rating + 2 * popularity) AS score
    ORDER BY score DESC
    LIMIT 10
    OPTIONAL MATCH (rec)-[:WRITTEN_BY]->(a:Author)
    RETURN rec.title AS title,
           rec.thumbnail AS thumbnail,
           rec.average_rating AS average_rating,
           collect(DISTINCT a.name) AS authors,
           score
    """
    with db.get_session() as session:
        result = session.run(cypher_query, parameters={"title": title})
        return [record.data() for record in result]

def get_all_books():
    cypher_query = """
    MATCH (b:Book)
    OPTIONAL MATCH (b)-[:WRITTEN_BY]->(a:Author)
    OPTIONAL MATCH (b)-[:HAS_CATEGORY]->(c:Category)
    RETURN b.title AS title,
           b.subtitle AS subtitle,
           b.thumbnail AS thumbnail,
           b.average_rating AS average_rating,
           collect(DISTINCT a.name) AS authors,
           collect(DISTINCT c.name) AS categories
    ORDER BY b.title ASC
    """
    with db.get_session() as session:
        result = session.run(cypher_query)
        return [record.data() for record in result]

def add_book_to_library(uid: str, book_title: str):
    cypher_query = """
    MERGE (u:User {uid: $uid})
    WITH u
    MATCH (b:Book {title: $book_title})
    MERGE (u)-[:ADDED_TO_LIBRARY]->(b)
    RETURN b
    """
    with db.get_session() as session:
        result = session.run(cypher_query, parameters={"uid": uid, "book_title": book_title})
        return result.single() is not None

def get_user_library(uid: str):
    cypher_query = """
    MATCH (u:User {uid: $uid})-[:ADDED_TO_LIBRARY]->(b:Book)
    OPTIONAL MATCH (b)-[:WRITTEN_BY]->(a:Author)
    OPTIONAL MATCH (b)-[:HAS_CATEGORY]->(c:Category)
    RETURN b.title AS title,
           b.subtitle AS subtitle,
           b.thumbnail AS thumbnail,
           b.average_rating AS average_rating,
           collect(DISTINCT a.name) AS authors,
           collect(DISTINCT c.name) AS categories
    ORDER BY b.title ASC
    """
    with db.get_session() as session:
        result = session.run(cypher_query, parameters={"uid": uid})
        return [record.data() for record in result]

def simulate_graph_traversal(start_node_name: str, algorithm: str, limit: int = None):
    """
    Simulates BFS or DFS from a starting node.
    Returns ordered lists of visited nodes and edges, plus the whole graph.
    """
    query = """
    MATCH (n)-[r]->(m)
    WHERE (n:Book OR n:Author OR n:Category) AND (m:Book OR m:Author OR m:Category)
    RETURN labels(n) AS source_labels, coalesce(n.name, n.title) AS source_name,
           labels(m) AS target_labels, coalesce(m.name, m.title) AS target_name,
           type(r) AS rel_type,
           n.thumbnail AS source_thumbnail, n.average_rating AS source_rating,
           m.thumbnail AS target_thumbnail, m.average_rating AS target_rating
    """
    with db.get_session() as session:
        result = session.run(query)
        records = [record.data() for record in result]
        
    adj = {}
    nodes = {}
    for r in records:
        src = r["source_name"]
        tgt = r["target_name"]
        src_lbl = r["source_labels"][0] if r["source_labels"] else "Unknown"
        tgt_lbl = r["target_labels"][0] if r["target_labels"] else "Unknown"
        rel_type = r["rel_type"]
        
        if src not in nodes:
            nodes[src] = {
                "id": src, 
                "group": src_lbl, 
                "label": src,
                "thumbnail": r.get("source_thumbnail"),
                "average_rating": r.get("source_rating"),
                "authors": []
            }
        if tgt not in nodes:
            nodes[tgt] = {
                "id": tgt, 
                "group": tgt_lbl, 
                "label": tgt,
                "thumbnail": r.get("target_thumbnail"),
                "average_rating": r.get("target_rating"),
                "authors": []
            }
            
        # Parse WRITTEN_BY relationships to link authors directly inside book nodes
        if rel_type == "WRITTEN_BY":
            if src_lbl == "Book" and tgt_lbl == "Author":
                if tgt not in nodes[src]["authors"]:
                    nodes[src]["authors"].append(tgt)
            elif src_lbl == "Author" and tgt_lbl == "Book":
                if src not in nodes[tgt]["authors"]:
                    nodes[tgt]["authors"].append(src)
            
        if src not in adj: adj[src] = []
        if tgt not in adj: adj[tgt] = []
        
        adj[src].append((tgt, rel_type))
        adj[tgt].append((src, rel_type))
        
    if start_node_name not in nodes:
        return {"visited_nodes": [], "visited_edges": [], "graph_nodes": list(nodes.values()), "graph_edges": [{"source": r["source_name"], "target": r["target_name"], "label": r["rel_type"]} for r in records]}
        
    visited = set()
    order_nodes = []
    order_edges = []
    
    if algorithm == "bfs":
        from collections import deque
        queue = deque([(start_node_name, None, None)])
        while queue:
            if limit and len(visited) >= limit:
                break
            curr, parent, rel = queue.popleft()
            if curr not in visited:
                visited.add(curr)
                order_nodes.append(nodes[curr])
                if parent:
                    order_edges.append({"source": parent, "target": curr, "label": rel})
                # Sort neighbors alphabetically for deterministic BFS
                neighbors = sorted(adj.get(curr, []), key=lambda x: x[0])
                for neighbor, r_type in neighbors:
                    if neighbor not in visited:
                        queue.append((neighbor, curr, r_type))
    else: # dfs
        stack = [(start_node_name, None, None)]
        while stack:
            if limit and len(visited) >= limit:
                break
            curr, parent, rel = stack.pop()
            if curr not in visited:
                visited.add(curr)
                order_nodes.append(nodes[curr])
                if parent:
                    order_edges.append({"source": parent, "target": curr, "label": rel})
                neighbors = sorted(adj.get(curr, []), key=lambda x: x[0], reverse=True)
                for neighbor, r_type in neighbors:
                    if neighbor not in visited:
                        stack.append((neighbor, curr, r_type))
                        
    return {
        "visited_nodes": order_nodes,
        "visited_edges": order_edges,
        "graph_nodes": list(nodes.values()),
        "graph_edges": [{"source": r["source_name"], "target": r["target_name"], "label": r["rel_type"]} for r in records]
    }

def get_user_followed_authors(uid: str):
    cypher_query = """
    MATCH (u:User {uid: $uid})-[:FOLLOWS]->(a:Author)
    OPTIONAL MATCH (b:Book)-[:WRITTEN_BY]->(a)
    RETURN a.name AS name,
           a.description AS description,
           a.image_url AS image_url,
           count(b) AS book_count,
           true AS is_followed
    ORDER BY a.name ASC
    """
    with db.get_session() as session:
        result = session.run(cypher_query, parameters={"uid": uid})
        authors = []
        for record in result:
            a_data = record.data()
            a_data["image_url"] = get_actual_image_url(a_data["name"])
            authors.append(a_data)
        return authors

def get_personalized_recommendations(uid: str):
    cypher_query = """
    MERGE (u:User {uid: $uid})
    WITH u
    
    // Category overlap matches (Weight = 1 point per match)
    OPTIONAL MATCH (u)-[:ADDED_TO_LIBRARY]->(b:Book)-[:HAS_CATEGORY]->(c:Category)<-[:HAS_CATEGORY]-(rec1:Book)
    WHERE NOT (u)-[:ADDED_TO_LIBRARY]->(rec1) AND b <> rec1
    
    // Followed author matches (Weight = 5 points per match)
    OPTIONAL MATCH (u)-[:FOLLOWS]->(a:Author)<-[:WRITTEN_BY]-(rec2:Book)
    WHERE NOT (u)-[:ADDED_TO_LIBRARY]->(rec2)
    
    // Combine recommendations and calculate scores
    WITH collect({book: rec1, weight: 1}) + collect({book: rec2, weight: 5}) AS raw_recs
    UNWIND raw_recs AS raw_rec
    WITH raw_rec.book AS rec, raw_rec.weight AS weight
    WHERE rec IS NOT NULL
    
    WITH rec, sum(weight) AS intersection_score
    
    OPTIONAL MATCH (rec)-[:WRITTEN_BY]->(ra:Author)
    OPTIONAL MATCH (rec)-[:HAS_CATEGORY]->(rc:Category)
    
    RETURN rec.title AS title,
           rec.thumbnail AS thumbnail,
           rec.average_rating AS average_rating,
           collect(DISTINCT ra.name) AS authors,
           collect(DISTINCT rc.name) AS categories,
           intersection_score AS score
    ORDER BY score DESC, rec.average_rating DESC
    LIMIT 10
    """
    with db.get_session() as session:
        result = session.run(cypher_query, parameters={"uid": uid})
        recs = [record.data() for record in result]
        
        if len(recs) < 10:
            limit = 10 - len(recs)
            existing_titles = [r["title"] for r in recs]
            
            backfill_query = """
            MATCH (u:User {uid: $uid})
            MATCH (b:Book)
            WHERE NOT b.title IN $existing_titles AND NOT (u)-[:ADDED_TO_LIBRARY]->(b)
            OPTIONAL MATCH (b)-[:WRITTEN_BY]->(a:Author)
            OPTIONAL MATCH (b)-[:HAS_CATEGORY]->(c:Category)
            RETURN b.title AS title,
                   b.thumbnail AS thumbnail,
                   b.average_rating AS average_rating,
                   collect(DISTINCT a.name) AS authors,
                   collect(DISTINCT c.name) AS categories,
                   0 AS score
            ORDER BY b.average_rating DESC
            LIMIT $limit
            """
            backfill_res = session.run(backfill_query, parameters={"uid": uid, "existing_titles": existing_titles, "limit": limit})
            recs.extend([record.data() for record in backfill_res])
            
        return recs

def get_db_stats():
    """
    Returns the real count of books, authors, and categories in Neo4j.
    """
    with db.get_session() as session:
        books_res = session.run("MATCH (b:Book) RETURN count(b) as count")
        books_count = books_res.single()["count"]
        
        authors_res = session.run("MATCH (a:Author) RETURN count(a) as count")
        authors_count = authors_res.single()["count"]
        
        categories_res = session.run("MATCH (c:Category) RETURN count(c) as count")
        categories_count = categories_res.single()["count"]
        
        return {
            "books_count": books_count,
            "authors_count": authors_count,
            "categories_count": categories_count
        }
