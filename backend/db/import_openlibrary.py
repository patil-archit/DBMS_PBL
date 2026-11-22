"""
Adds popular books from Open Library (https://openlibrary.org) to the BookLog
database, with cover images, descriptions, publishers, authors, author bios
and author photos.

Run AFTER seed_from_csv.py (it only adds rows, never deletes):
    backend/venv/bin/python backend/db/import_openlibrary.py            # default 80 new books per genre
    backend/venv/bin/python backend/db/import_openlibrary.py --per-genre 40

API responses are cached in backend/db/.openlibrary_cache/, so re-running is fast.
"""
import argparse
import hashlib
import json
import os
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import psycopg2
from dotenv import load_dotenv

HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(os.path.dirname(HERE), ".env"))
# Setup scripts run as your own (superuser) account, not the API role
DATABASE_URL = os.getenv("DATABASE_ADMIN_URL", "postgresql://localhost:5432/booklog")
CACHE_DIR = os.path.join(HERE, ".openlibrary_cache")
USER_AGENT = "BookLog-student-project/1.0"
CACHE_ONLY = False  # --cache-only: use what is already downloaded, never touch the network

# Open Library subject to search  ->  BookLog genre name
GENRE_QUERIES = {
    "fantasy": "Fantasy",
    "science_fiction": "Science Fiction",
    "mystery": "Mystery",
    "detective_and_mystery_stories": "Detective Fiction",
    "thrillers": "Thriller",
    "horror": "Horror",
    "romance": "Romance",
    "historical_fiction": "Historical Fiction",
    "classic_literature": "Classic",
    "dystopias": "Dystopian",
    "adventure_stories": "Adventure",
    "young_adult_fiction": "Young Adult",
    "humorous_fiction": "Humor",
    "poetry": "Poetry",
    "philosophy": "Philosophy",
    "biography": "Biography",
    "history": "History",
    "self-help": "Self-Help",
    "magic_realism": "Magical Realism",
    "war": "War",
    "gothic_fiction": "Gothic",
    "mythology": "Mythology",
    "short_stories": "Short Stories",
    "psychology": "Psychology",
    "popular_science": "Popular Science",
    "business": "Business",
    "graphic_novels": "Graphic Novels",
    "childrens_fiction": "Children's",
    # --- wider catalogue ---
    "epic_fantasy": "Fantasy", "urban_fantasy": "Fantasy", "space_opera": "Space Opera",
    "cyberpunk": "Science Fiction", "time_travel": "Science Fiction", "robots": "Science Fiction",
    "vampires": "Horror", "ghost_stories": "Horror", "zombies": "Horror",
    "suspense": "Thriller", "spy_stories": "Thriller", "crime": "Crime", "legal_stories": "Thriller",
    "love_stories": "Romance", "regency_fiction": "Romance",
    "satire": "Satire", "coming_of_age": "Coming-of-Age", "family": "Literary Fiction",
    "literary_fiction": "Literary Fiction", "american_fiction": "Literary Fiction",
    "english_fiction": "Literary Fiction", "indian_fiction_(english)": "Literary Fiction",
    "japanese_fiction": "World Literature", "french_fiction": "World Literature",
    "russian_fiction": "World Literature", "latin_american_fiction": "World Literature",
    "african_fiction": "World Literature",
    "politics": "Politics", "economics": "Economics", "sociology": "Society",
    "feminism": "Society", "religion": "Religion", "spirituality": "Spirituality",
    "art": "Art", "music": "Music", "film": "Film", "photography": "Art",
    "cooking": "Food", "travel": "Travel", "nature": "Nature", "sports": "Sports",
    "health": "Health", "mathematics": "Science", "physics": "Science",
    "astronomy": "Science", "biology": "Science", "evolution": "Science",
    "computers": "Technology", "artificial_intelligence": "Technology", "programming": "Technology",
    "autobiography": "Memoir", "memoirs": "Memoir", "essays": "Essays", "drama": "Drama",
    "plays": "Drama", "true_crime": "True Crime", "world_war,_1939-1945": "War",
    "ancient_history": "History", "medieval": "History", "fairy_tales": "Fairy Tales",
    "animals": "Children's", "picture_books": "Children's", "school_stories": "Young Adult",
    "superheroes": "Graphic Novels", "manga": "Graphic Novels", "western_stories": "Western",
    "sea_stories": "Adventure", "paranormal_fiction": "Paranormal", "witches": "Paranormal",
    "dragons": "Fantasy", "magic": "Fantasy", "post-apocalyptic_fiction": "Dystopian",
    "productivity": "Self-Help", "leadership": "Business", "entrepreneurship": "Business",
    "personal_finance": "Business", "mental_health": "Psychology", "neuroscience": "Science",
}

# Extra genres picked up from a book's own subject list (lower-case subject -> genre)
SUBJECT_TO_GENRE = {
    "fantasy": "Fantasy", "fantasy fiction": "Fantasy", "epic fantasy": "Fantasy",
    "science fiction": "Science Fiction", "space opera": "Space Opera",
    "mystery": "Mystery", "mystery fiction": "Mystery", "detective and mystery stories": "Detective Fiction",
    "thriller": "Thriller", "thrillers": "Thriller", "suspense": "Thriller",
    "horror": "Horror", "horror fiction": "Horror", "horror stories": "Horror",
    "romance": "Romance", "love stories": "Romance",
    "historical fiction": "Historical Fiction", "classic literature": "Classic", "classics": "Classic",
    "dystopias": "Dystopian", "dystopian": "Dystopian", "adventure": "Adventure",
    "adventure stories": "Adventure", "action & adventure": "Adventure",
    "young adult fiction": "Young Adult", "humor": "Humor", "humorous fiction": "Humor",
    "poetry": "Poetry", "philosophy": "Philosophy", "biography": "Biography",
    "magic realism": "Magical Realism", "magical realism": "Magical Realism",
    "war": "War", "war stories": "War", "gothic fiction": "Gothic", "mythology": "Mythology",
    "short stories": "Short Stories", "psychology": "Psychology", "satire": "Satire",
    "coming of age": "Coming-of-Age", "politics": "Politics",
}

# Skip adult-only content
BLOCKED_SUBJECTS = {"erotica", "erotic fiction", "smut", "explicit", "erotic stories", "spicy", "dark romance"}

MAX_GENRES_PER_BOOK = 4


# ---------------------------------------------------------------------
# HTTP with on-disk cache
# ---------------------------------------------------------------------
def fetch_json(url, retries=3):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, hashlib.sha1(url.encode()).hexdigest() + ".json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    if CACHE_ONLY:
        return None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.load(resp)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f)
            return data
        except Exception as e:  # network error, 404, 429, ...
            if getattr(e, "code", None) == 404:
                return None
            time.sleep(2 * (attempt + 1))
    return None


def fetch_many(urls, workers=4):
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return dict(zip(urls, pool.map(fetch_json, urls)))


# ---------------------------------------------------------------------
# Cleaning helpers
# ---------------------------------------------------------------------
def norm_key(text):
    return re.sub(r"[^a-z0-9]", "", (text or "").lower())


def clean_text(value, limit=1500):
    if isinstance(value, dict):
        value = value.get("value")
    if not value or not isinstance(value, str):
        return None
    text = value.replace("\r", "")
    text = re.split(r"\n-{3,}|\n\*{3,}|\(\[source\]", text)[0]           # drop trailing source/notes sections
    text = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", text)                  # markdown links -> text
    text = re.sub(r"\[[^\]]*\]:\s*\S+", "", text)                         # reference-style links
    text = re.sub(r"[*_]{1,3}([^*_]+)[*_]{1,3}", r"\1", text)             # bold / italics
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > limit:
        text = text[:limit].rsplit(". ", 1)[0] + "."
    return text or None


def pick_isbn(isbns):
    for i in isbns or []:
        if len(i) == 13 and i.startswith(("978", "979")):
            return i
    return None


# ---------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--per-genre", type=int, default=80, help="max new books per genre")
    parser.add_argument("--pages", type=int, default=3, help="search result pages (100 each) per subject")
    parser.add_argument("--workers", type=int, default=4, help="parallel requests for details")
    parser.add_argument("--cache-only", action="store_true",
                        help="import only what is already in the download cache (no network); "
                             "authors not downloaded yet are added without a bio or photo")
    args = parser.parse_args()
    global CACHE_ONLY
    CACHE_ONLY = args.cache_only

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("ALTER TABLE author ADD COLUMN IF NOT EXISTS photo_url TEXT")
    conn.commit()

    cur.execute("SELECT lower(title) FROM book")
    seen_titles = {r[0] for r in cur.fetchall()}
    cur.execute("SELECT isbn FROM book WHERE isbn IS NOT NULL")
    seen_isbns = {r[0] for r in cur.fetchall()}
    cur.execute("SELECT name FROM author")
    existing_authors = {norm_key(r[0]): r[0] for r in cur.fetchall()}

    # 1. Search each genre for popular English books with covers
    fields = ("key,title,subtitle,author_name,author_key,first_publish_year,isbn,"
              "number_of_pages_median,ratings_average,ratings_count,cover_i,publisher,subject")
    picked = {}  # work key -> book dict
    for subject, genre in GENRE_QUERIES.items():
        added = 0
        for page in range(1, args.pages + 1):
            q = urllib.parse.urlencode({
                "q": f"subject:{subject} language:eng", "fields": fields,
                "sort": "readinglog", "limit": 100, "page": page,
            })
            data = fetch_json(f"https://openlibrary.org/search.json?{q}") or {}
            if not data.get("docs"):
                break
            for doc in data.get("docs", []):
                if added >= args.per_genre:
                    break
                key, title = doc.get("key"), (doc.get("title") or "").strip()
                if key in picked:
                    picked[key]["genres"].add(genre)
                    continue
                subjects = {s.lower() for s in doc.get("subject", [])}
                if (not title or not doc.get("cover_i") or not doc.get("author_name")
                        or len(title) > 200 or title.lower() in seen_titles
                        or subjects & BLOCKED_SUBJECTS or not doc.get("ratings_count")):
                    continue
                genres = {genre} | {SUBJECT_TO_GENRE[s] for s in subjects if s in SUBJECT_TO_GENRE}
                seen_titles.add(title.lower())
                picked[key] = {**doc, "title": title, "genres": genres}
                added += 1
            if added >= args.per_genre:
                break
        print(f"  {genre:<20} +{added}")
    print(f"Found {len(picked)} new books. Fetching descriptions...")

    # 2. Descriptions (one request per work)
    works = fetch_many([f"https://openlibrary.org{k}.json" for k in picked], args.workers)

    # 3. Author bios and photos (one request per new author)
    author_keys = {}
    for doc in picked.values():
        for name, akey in zip(doc.get("author_name", []), doc.get("author_key", [])):
            if norm_key(name) not in existing_authors:
                author_keys.setdefault(akey, name)
    print(f"Fetching {len(author_keys)} authors...")
    authors = fetch_many([f"https://openlibrary.org/authors/{k}.json" for k in author_keys], args.workers)

    # 4. Insert
    def author_id_for(name, akey):
        canonical = existing_authors.get(norm_key(name), name)
        info = authors.get(f"https://openlibrary.org/authors/{akey}.json") or {}
        photos = [p for p in info.get("photos", []) if isinstance(p, int) and p > 0]
        photo = f"https://covers.openlibrary.org/a/id/{photos[0]}-L.jpg" if photos else None
        cur.execute(
            """
            INSERT INTO author (name, bio, photo_url) VALUES (%s, %s, %s)
            ON CONFLICT (name) DO UPDATE
                SET bio = COALESCE(author.bio, EXCLUDED.bio),
                    photo_url = COALESCE(author.photo_url, EXCLUDED.photo_url)
            RETURNING author_id
            """,
            (canonical, clean_text(info.get("bio"), 800), photo),
        )
        existing_authors[norm_key(canonical)] = canonical
        return cur.fetchone()[0]

    inserted = 0
    for key, doc in picked.items():
        work = works.get(f"https://openlibrary.org{key}.json") or {}
        first_author = doc["author_name"][0]
        year = doc.get("first_publish_year")
        year = year if isinstance(year, int) and 0 <= year <= 2100 else None
        description = clean_text(work.get("description")) or (
            f"{doc['title']} is a {sorted(doc['genres'])[0].lower()} book by {first_author}"
            + (f", first published in {year}." if year else ".")
        )
        isbn = pick_isbn(doc.get("isbn"))
        if isbn in seen_isbns:
            isbn = None
        if isbn:
            seen_isbns.add(isbn)

        publisher_id = None
        publisher = next((p.strip() for p in doc.get("publisher", []) if p and len(p.strip()) <= 200), None)
        if publisher:
            cur.execute(
                """
                INSERT INTO publisher (name) VALUES (%s)
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING publisher_id
                """,
                (publisher,),
            )
            publisher_id = cur.fetchone()[0]

        pages = doc.get("number_of_pages_median")
        cur.execute(
            """
            INSERT INTO book (publisher_id, title, subtitle, isbn, language, description, pub_year,
                              page_count, avg_rating, ratings_count, cover_url)
            VALUES (%s, %s, %s, %s, 'en', %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING
            RETURNING book_id
            """,
            (
                publisher_id, doc["title"], (doc.get("subtitle") or "")[:500] or None, isbn,
                description, year, pages if pages and pages > 0 else None,
                round(min(max(doc.get("ratings_average") or 0, 0), 5), 2), doc.get("ratings_count") or 0,
                f"https://covers.openlibrary.org/b/id/{doc['cover_i']}-L.jpg",
            ),
        )
        row = cur.fetchone()
        if not row:
            continue
        book_id = row[0]

        for name, akey in zip(doc["author_name"][:3], doc.get("author_key", [])[:3]):
            cur.execute("INSERT INTO book_author VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (author_id_for(name, akey), book_id))

        primary = next((g for g in GENRE_QUERIES.values() if g in doc["genres"]), sorted(doc["genres"])[0])
        for name in [primary] + sorted(doc["genres"] - {primary})[: MAX_GENRES_PER_BOOK - 1]:
            cur.execute(
                """
                INSERT INTO genre (name) VALUES (%s)
                ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
                RETURNING genre_id
                """,
                (name,),
            )
            cur.execute("INSERT INTO book_genre VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (cur.fetchone()[0], book_id))
        inserted += 1
        if inserted % 500 == 0:
            conn.commit()
            print(f"  inserted {inserted}...", flush=True)

    conn.commit()
    cur.execute("SELECT (SELECT count(*) FROM book), (SELECT count(*) FROM author), "
                "(SELECT count(*) FROM genre), (SELECT count(*) FROM publisher)")
    b, a, g, p = cur.fetchone()
    conn.close()
    print(f"Inserted {inserted} books. Totals: {b} books, {a} authors, {g} genres, {p} publishers.")


if __name__ == "__main__":
    main()
