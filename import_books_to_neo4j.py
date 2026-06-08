import pandas as pd
from neo4j import GraphDatabase

# =========================================
# NEO4J CONNECTION
# =========================================

URI = "bolt://localhost:7687"

USERNAME = "neo4j"

PASSWORD = "PLKoij#@1"

driver = GraphDatabase.driver(
    URI,
    auth=(USERNAME, PASSWORD)
)

# =========================================
# LOAD CSV
# =========================================

df = pd.read_csv("data.csv")

# Fill missing values
# Fill text columns
text_columns = [
    "title",
    "subtitle",
    "authors",
    "categories",
    "thumbnail",
    "description",
    "isbn13",
    "isbn10"
]

for col in text_columns:

    if col in df.columns:
        df[col] = df[col].fillna("")

# Fill numeric columns
numeric_columns = [
    "published_year",
    "average_rating",
    "num_pages",
    "ratings_count"
]

for col in numeric_columns:

    if col in df.columns:
        df[col] = df[col].fillna(0)

print("TOTAL BOOKS:", len(df))

# =========================================
# CREATE GRAPH FUNCTION
# =========================================

def create_graph(tx, row):

    # -------------------------------------
    # CREATE BOOK NODE
    # -------------------------------------

    tx.run(

        """
        MERGE (b:Book {title: $title})

        SET
            b.subtitle = $subtitle,
            b.description = $description,
            b.thumbnail = $thumbnail,
            b.published_year = $published_year,
            b.average_rating = $average_rating,
            b.num_pages = $num_pages,
            b.ratings_count = $ratings_count,
            b.isbn13 = $isbn13,
            b.isbn10 = $isbn10
        """,

        title=row.get("title", ""),

        subtitle=row.get("subtitle", ""),

        description=row.get("description", ""),

        thumbnail=row.get("thumbnail", ""),

        published_year=row.get("published_year", ""),

        average_rating=row.get("average_rating", 0),

        num_pages=row.get("num_pages", 0),

        ratings_count=row.get("ratings_count", 0),

        isbn13=row.get("isbn13", ""),

        isbn10=row.get("isbn10", "")
    )

    # -------------------------------------
    # AUTHOR NODES + RELATIONSHIPS
    # -------------------------------------

    authors = str(
        row.get("authors", "")
    ).split(",")

    for author in authors:

        author = author.strip()

        if author:

            tx.run(

                """
                MERGE (a:Author {name: $author})

                WITH a

                MATCH (b:Book {title: $title})

                MERGE (b)-[:WRITTEN_BY]->(a)
                """,

                author=author,

                title=row.get("title", "")
            )

    # -------------------------------------
    # CATEGORY NODES + RELATIONSHIPS
    # -------------------------------------

    categories = str(
        row.get("categories", "")
    ).split(",")

    for category in categories:

        category = category.strip()

        if category:

            tx.run(

                """
                MERGE (c:Category {name: $category})

                WITH c

                MATCH (b:Book {title: $title})

                MERGE (b)-[:HAS_CATEGORY]->(c)
                """,

                category=category,

                title=row.get("title", "")
            )

# =========================================
# IMPORT DATA
# =========================================

with driver.session(database="bookgraph") as session:

    for index, row in df.iterrows():

        session.execute_write(
            create_graph,
            row
        )

        # Progress counter
        if index % 100 == 0:

            print(
                f"Imported {index} books..."
            )

# =========================================
# FINISHED
# =========================================

print("\nGRAPH IMPORT COMPLETE")

driver.close()