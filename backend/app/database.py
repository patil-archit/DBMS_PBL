import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "PLKoij#@1")

class Database:
    def __init__(self):
        self._driver = None

    def connect(self):
        if not self._driver:
            self._driver = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))

    def close(self):
        if self._driver:
            self._driver.close()
            self._driver = None

    def get_session(self):
        if not self._driver:
            self.connect()
        return self._driver.session(database="bookgraph")

# Global DB instance
db = Database()
