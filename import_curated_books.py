import csv
import os
from neo4j import GraphDatabase

# =========================================
# CONFIGURATION
# =========================================
URI = "bolt://localhost:7687"
USERNAME = "neo4j"
PASSWORD = "PLKoij#@1"
DATABASE_NAME = "bookgraph"
SOURCE_CSV = "master_curated_books_universe.csv"
TARGET_CSV = "data.csv"

# =========================================
# PARSE THE USER'S CURATED CSV
# =========================================
print(f"Reading {SOURCE_CSV}...")
books = []

with open(SOURCE_CSV, mode="r", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        title = row.get("Book:title", "").strip()
        if not title:
            continue
        
        # Safely convert types
        try:
            pub_year = int(float(row.get("Book:published_year", 0)))
        except ValueError:
            pub_year = 0
            
        try:
            avg_rating = float(row.get("Book:average_rating", 0.0))
        except ValueError:
            avg_rating = 0.0
            
        try:
            pages = int(float(row.get("Book:num_pages", 0)))
        except ValueError:
            pages = 0
            
        try:
            ratings = int(float(row.get("Book:ratings_count", 0)))
        except ValueError:
            ratings = 0

        # Author and category parsing
        author_val = row.get("Author:name", "").strip()
        authors = [a.strip() for a in author_val.split(",") if a.strip()] if author_val else []
        
        cat_val = row.get("Category:name", "").strip()
        categories = [c.strip() for c in cat_val.split(",") if c.strip()] if cat_val else []

        books.append({
            "title": title,
            "subtitle": row.get("Book:subtitle", "").strip(),
            "description": row.get("Book:description", "").strip(),
            "thumbnail": row.get("Book:thumbnail", "").strip(),
            "published_year": pub_year,
            "average_rating": avg_rating,
            "num_pages": pages,
            "ratings_count": ratings,
            "isbn13": row.get("Book:isbn13", "").strip(),
            "isbn10": row.get("Book:isbn10", "").strip(),
            "authors": authors,
            "categories": categories
        })

print(f"Loaded {len(books)} books successfully from {SOURCE_CSV}.")

# =========================================
# SYNC AND WRITE BACK TO STANDARD data.csv
# =========================================
csv_headers = [
    "isbn13", "isbn10", "title", "subtitle", "authors", 
    "categories", "thumbnail", "description", "published_year", 
    "average_rating", "num_pages", "ratings_count"
]

with open(TARGET_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=csv_headers)
    writer.writeheader()
    for b in books:
        writer.writerow({
            "isbn13": b["isbn13"],
            "isbn10": b["isbn10"],
            "title": b["title"],
            "subtitle": b["subtitle"],
            "authors": ", ".join(b["authors"]),
            "categories": ", ".join(b["categories"]),
            "thumbnail": b["thumbnail"],
            "description": b["description"],
            "published_year": b["published_year"],
            "average_rating": b["average_rating"],
            "num_pages": b["num_pages"],
            "ratings_count": b["ratings_count"]
        })

print(f"Synced and wrote standard {TARGET_CSV} file.")

# =========================================
# IMPORT TO NEO4J
# =========================================
print("\nConnecting to Neo4j...")
driver = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))

try:
    with driver.session(database=DATABASE_NAME) as session:
        # 1. Clear database
        print("Skipping database wipe to merge old and new data...")
        # session.run("MATCH (n) DETACH DELETE n")
        print("Database preserved.")

        # 2. Ingest books
        print("Importing books...")
        
        import_query = """
        UNWIND $batch AS row
        MERGE (b:Book {title: row.title})
        SET b.subtitle = row.subtitle,
            b.description = row.description,
            b.thumbnail = row.thumbnail,
            b.published_year = row.published_year,
            b.average_rating = row.average_rating,
            b.num_pages = row.num_pages,
            b.ratings_count = row.ratings_count,
            b.isbn13 = row.isbn13,
            b.isbn10 = row.isbn10

        WITH b, row
        UNWIND row.authors AS author_name
        MERGE (a:Author {name: author_name})
        MERGE (b)-[:WRITTEN_BY]->(a)

        WITH b, row
        UNWIND row.categories AS category_name
        MERGE (c:Category {name: category_name})
        MERGE (b)-[:HAS_CATEGORY]->(c)
        """

        # Ingest all loaded books
        session.run(import_query, parameters={"batch": books})
        print(f"Imported all {len(books)} books successfully.")

        # 3. Print verification counts
        print("\nVerifying imported counts...")
        b_count = session.run("MATCH (b:Book) RETURN count(b) as count").single()["count"]
        a_count = session.run("MATCH (a:Author) RETURN count(a) as count").single()["count"]
        c_count = session.run("MATCH (c:Category) RETURN count(c) as count").single()["count"]
        r_count = session.run("MATCH ()-[r]->() RETURN count(r) as count").single()["count"]
        
        print(f"Books in DB: {b_count}")
        print(f"Authors in DB: {a_count}")
        print(f"Categories/Tags in DB: {c_count}")
        print(f"Relationships in DB: {r_count}")

    print("\nIMPORT COMPLETED SUCCESSFULLY!")

except Exception as e:
    print(f"\nAn error occurred during import: {e}")
finally:
    driver.close()
