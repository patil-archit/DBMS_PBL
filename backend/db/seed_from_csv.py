"""
Creates the BookLog schema and loads the book catalogue from the project CSVs
(data.csv, then master_curated_books_universe_180.csv; duplicate titles are skipped).
Both CSV header styles are accepted ("title" and "Book:title").

Usage (from the repo root):
    createdb booklog                       # once
    backend/venv/bin/python backend/db/seed_from_csv.py [file.csv ...]

DATABASE_URL is read from backend/.env (default: postgresql://localhost:5432/booklog).
This DROPS and recreates all tables, so users/diary data are wiped.
"""
import csv
import os
import sys

import psycopg2
from dotenv import load_dotenv

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(os.path.dirname(HERE))
load_dotenv(os.path.join(REPO_ROOT, "backend", ".env"))

# Setup scripts run as your own (superuser) account, not the API role
DATABASE_URL = os.getenv("DATABASE_ADMIN_URL", "postgresql://localhost:5432/booklog")
CSV_PATHS = sys.argv[1:] or [
    os.path.join(REPO_ROOT, "data.csv"),
    os.path.join(REPO_ROOT, "master_curated_books_universe_180.csv"),
]

# "Book:title" style headers -> plain names
HEADER_MAP = {
    "Book:title": "title", "Book:subtitle": "subtitle", "Book:description": "description",
    "Book:thumbnail": "thumbnail", "Book:published_year": "published_year",
    "Book:average_rating": "average_rating", "Book:num_pages": "num_pages",
    "Book:ratings_count": "ratings_count", "Book:isbn13": "isbn13", "Book:isbn10": "isbn10",
    "Author:name": "authors", "Category:name": "categories",
}


def read_rows(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return [{HEADER_MAP.get(k, k): v for k, v in row.items()} for row in csv.DictReader(f)]


def to_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def split_list(value):
    return [v.strip() for v in (value or "").split(",") if v.strip()]


def main():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn, conn.cursor() as cur:
            with open(os.path.join(HERE, "schema.sql"), encoding="utf-8") as f:
                cur.execute(f.read())

            rows = [row for path in CSV_PATHS for row in read_rows(path)]

            book_count = 0
            for row in rows:
                title = (row.get("title") or "").strip()
                if not title:
                    continue

                pages = to_int(row.get("num_pages"))
                rating = to_float(row.get("average_rating")) or 0.0
                cur.execute(
                    """
                    INSERT INTO book (title, subtitle, isbn, description, pub_year,
                                      page_count, avg_rating, ratings_count, cover_url)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                    RETURNING book_id
                    """,
                    (
                        title,
                        (row.get("subtitle") or "").strip() or None,
                        (row.get("isbn13") or "").strip() or None,
                        (row.get("description") or "").strip() or None,
                        to_int(row.get("published_year")),
                        pages if pages and pages > 0 else None,
                        min(max(rating, 0.0), 5.0),
                        to_int(row.get("ratings_count")) or 0,
                        (row.get("thumbnail") or "").strip() or None,
                    ),
                )
                res = cur.fetchone()
                if not res:
                    continue  # duplicate title
                book_id = res[0]
                book_count += 1

                for name in split_list(row.get("authors")):
                    cur.execute(
                        """
                        INSERT INTO author (name) VALUES (%s)
                        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                        RETURNING author_id
                        """,
                        (name,),
                    )
                    cur.execute(
                        "INSERT INTO book_author (author_id, book_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (cur.fetchone()[0], book_id),
                    )

                for name in split_list(row.get("categories")):
                    cur.execute(
                        """
                        INSERT INTO genre (name) VALUES (%s)
                        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                        RETURNING genre_id
                        """,
                        (name,),
                    )
                    cur.execute(
                        "INSERT INTO book_genre (genre_id, book_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (cur.fetchone()[0], book_id),
                    )

            cur.execute("SELECT (SELECT count(*) FROM author), (SELECT count(*) FROM genre)")
            authors, genres = cur.fetchone()

        # Phase 2+ migrations (each file manages its own transaction)
        migrations_dir = os.path.join(HERE, "migrations")
        for name in sorted(os.listdir(migrations_dir)):
            if name.endswith(".sql"):
                with conn.cursor() as cur, open(os.path.join(migrations_dir, name), encoding="utf-8") as f:
                    cur.execute(f.read())
                conn.commit()
                print(f"Applied migration {name}")
        print(f"Loaded {book_count} books, {authors} authors, {genres} genres into {DATABASE_URL}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
