import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "PLKoij#@1")

print(f"Connecting to {URI} with {USERNAME}...")
driver = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))

try:
    with driver.session(database="bookgraph") as session:
        # Count books
        res_books = session.run("MATCH (b:Book) RETURN count(b) as count")
        books_count = res_books.single()["count"]
        
        # Count authors
        res_authors = session.run("MATCH (a:Author) RETURN count(a) as count")
        authors_count = res_authors.single()["count"]
        
        # Count categories
        res_categories = session.run("MATCH (c:Category) RETURN count(c) as count")
        categories_count = res_categories.single()["count"]
        
        print(f"Books: {books_count}")
        print(f"Authors: {authors_count}")
        print(f"Categories: {categories_count}")
        
        # Let's list the top 10 authors by book count
        res_top_authors = session.run("""
            MATCH (a:Author)<-[:WRITTEN_BY]-(b:Book)
            RETURN a.name as name, count(b) as book_count
            ORDER BY book_count DESC
            LIMIT 15
        """)
        print("\nTop 15 authors in database:")
        for record in res_top_authors:
            print(f"- {record['name']} ({record['book_count']} books)")
            
except Exception as e:
    print("Error:", e)
finally:
    driver.close()
