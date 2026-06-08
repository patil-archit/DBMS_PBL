import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv(dotenv_path="backend/.env")

URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "PLKoij#@1")

authors_data = {
    "Agatha Christie": {
        "description": "Dame Agatha Mary Clarissa Christie, Lady Mallowan, DBE was an English writer known for her 66 detective novels and 14 short story collections, particularly those revolving around fictional detectives Hercule Poirot and Miss Marple. She is the best-selling fiction writer of all time, with her novels having sold more than two billion copies globally.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Agatha_Christie.png/800px-Agatha_Christie.png"
    },
    "Rick Riordan": {
        "description": "Richard Russell Riordan Jr. is an American author best known for writing the Percy Jackson & the Olympians series, which features a twelve-year-old Percy Jackson who discovers he is a demigod. His books have been translated into 42 languages and sold more than 30 million copies in the US alone.",
        "image_url": "https://rickriordan.com/wp-content/uploads/2019/01/About-Rick-Riordan-1.jpg"
    },
    "J.K. Rowling": {
        "description": "Joanne Rowling, better known by her pen name J. K. Rowling, is a British author and philanthropist. She is best known for writing the Harry Potter fantasy series, which has won multiple awards and sold more than 500 million copies, becoming the best-selling book series in history.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/J._K._Rowling_2010.jpg/800px-J._K._Rowling_2010.jpg"
    },
    "Arthur Conan Doyle": {
        "description": "Sir Arthur Ignatius Conan Doyle was a British writer and physician. He created the character Sherlock Holmes in 1887 for A Study in Scarlet, the first of four novels and fifty-six short stories about Holmes and Dr. Watson. The Sherlock Holmes stories are widely considered milestones in the field of crime fiction.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Arthur_Conan_Doyle_by_Walter_Benington%2C_1914.png/800px-Arthur_Conan_Doyle_by_Walter_Benington%2C_1914.png"
    },
    "Dan Brown": {
        "description": "Daniel Gerhard Brown is an American author best known for his thriller novels, including the Robert Langdon novels: Angels & Demons, The Da Vinci Code, The Lost Symbol, Inferno, and Origin. His novels are search stories for secret keys, symbols, codes, conspiracy theories, and historical themes.",
        "image_url": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Dan_Brown_bookjacket_cropped.jpg/800px-Dan_Brown_bookjacket_cropped.jpg"
    },
    "Frank Herbert": {
        "description": "Franklin Patrick Herbert Jr. was an American science fiction author best known for the 1965 novel Dune and its five sequels. Although he is famous for science fiction, he was also a journalist, photographer, book reviewer, ecological consultant, and lecturer.",
        "image_url": "https://upload.wikimedia.org/wikipedia/en/3/32/Frank_Herbert_1978.jpg"
    }
}

def seed_authors():
    print(f"Connecting to Neo4j at {URI}...")
    driver = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))
    
    try:
        with driver.session(database="bookgraph") as session:
            for author_name, data in authors_data.items():
                print(f"Updating image link and bio details for {author_name}...")
                session.run("""
                    MERGE (a:Author {name: $name})
                    SET a.description = $description,
                        a.image_url = $image_url
                """, name=author_name, description=data["description"], image_url=data["image_url"])
                
            print("Successfully updated all author records in your Neo4j database!")
            
    except Exception as e:
        print("Update failed with error:", e)
    finally:
        driver.close()

if __name__ == "__main__":
    seed_authors()
