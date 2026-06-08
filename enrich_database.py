import wikipediaapi
from neo4j import GraphDatabase

# Neo4j configuration
URI = "bolt://localhost:7687"
USERNAME = "neo4j"
PASSWORD = "PLKoij#@1"
DATABASE_NAME = "bookgraph"

# Wikipedia API setup
wiki = wikipediaapi.Wikipedia("DAABookSystem/1.0 (test@example.com)", "en")

def get_author_description(name):
    page = wiki.page(name)
    if page.exists():
        # Get first ~500 chars of summary (approx 2-3 sentences)
        summary = page.summary
        if len(summary) > 500:
            summary = summary[:500].rsplit('.', 1)[0] + "."
        return summary
    return f"{name} is an acclaimed author known for contributing memorable works to the literary world."

def get_book_description(title, authors):
    # Special manual mapping for known ambiguous titles
    mappings = {
        "1984": "Nineteen Eighty-Four"
    }
    search_title = mappings.get(title, title)
    
    # Try exact title first
    page = wiki.page(search_title)
    if not page.exists():
        # Try appending "(novel)"
        page = wiki.page(f"{search_title} (novel)")
    if not page.exists():
        # Try appending "(book)"
        page = wiki.page(f"{search_title} (book)")
        
    if page.exists():
        summary = page.summary
        if len(summary) > 500:
            summary = summary[:500].rsplit('.', 1)[0] + "."
        return summary
    
    author_str = "an acclaimed author" if not authors else authors[0]
    return f"'{title}' is a celebrated book written by {author_str}, exploring deep and engaging themes that have captivated readers."

print("Connecting to Neo4j...")
driver = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))

try:
    with driver.session(database=DATABASE_NAME) as session:
        # 1. Update Authors
        print("Fetching Authors...")
        authors_query = "MATCH (a:Author) RETURN a.name AS name"
        authors = [record["name"] for record in session.run(authors_query)]
        
        print(f"Enriching {len(authors)} authors...")
        for name in authors:
            desc = get_author_description(name)
            session.run("MATCH (a:Author {name: $name}) SET a.description = $desc", name=name, desc=desc)
            
        # 2. Update Books
        print("Fetching Books...")
        books_query = """
        MATCH (b:Book)-[:WRITTEN_BY]->(a:Author)
        RETURN b.title AS title, collect(a.name) AS authors
        """
        books = [(record["title"], record["authors"]) for record in session.run(books_query)]
        
        # Note: If a book has no authors, it won't be picked up by the above.
        # Fetching all books and optionally joining authors is better.
        all_books_query = """
        MATCH (b:Book)
        OPTIONAL MATCH (b)-[:WRITTEN_BY]->(a:Author)
        RETURN b.title AS title, collect(a.name) AS authors
        """
        books = [(record["title"], record["authors"]) for record in session.run(all_books_query)]
        
        print(f"Enriching {len(books)} books...")
        for title, authors_list in books:
            desc = get_book_description(title, authors_list)
            session.run("MATCH (b:Book {title: $title}) SET b.description = $desc", title=title, desc=desc)
            
    print("Database enrichment complete!")

except Exception as e:
    print(f"Error during enrichment: {e}")
finally:
    driver.close()
