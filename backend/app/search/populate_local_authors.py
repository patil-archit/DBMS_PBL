import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "PLKoij#@1")

# Map of authors to their local assets inside public/authors/
local_authors_data = {
    "Agatha Christie": "/authors/agatha_christie.jpg",
    "Rick Riordan": "/authors/rick_riordan.jpg",
    "J.K. Rowling": "/authors/jk_rowling.jpg",
    "Arthur Conan Doyle": "/authors/arthur_conan_doyle.jpg",
    "Dan Brown": "/authors/dan_brown.jpg",
    "Frank Herbert": "/authors/frank_herbert.jpg"
}

def set_local_images():
    print(f"Connecting to Neo4j at {URI}...")
    driver = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))
    
    try:
        with driver.session(database="bookgraph") as session:
            for author_name, path in local_authors_data.items():
                print(f"Setting local image URL for {author_name} to '{path}'...")
                session.run("""
                    MATCH (a:Author {name: $name})
                    SET a.image_url = $path
                """, name=author_name, path=path)
                
            print("Successfully set all author database records to point to local assets!")
            
    except Exception as e:
        print("Update failed with error:", e)
    finally:
        driver.close()

if __name__ == "__main__":
    set_local_images()
