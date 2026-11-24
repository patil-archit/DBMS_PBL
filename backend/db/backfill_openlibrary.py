"""
Finish the Open Library import: fill in what the first run skipped.

  python backend/db/backfill_openlibrary.py            # descriptions + author bios/photos
  python backend/db/backfill_openlibrary.py --cache-only
  python backend/db/backfill_openlibrary.py --skip-books --wikipedia   # authors, with Wikipedia fallback

The first import (import_openlibrary.py) was stopped early and saved what it
had. That left books with a generated one-line description and authors with
no bio or photo. This script looks up their Open Library keys in the cached
search results, downloads the missing work/author records (cached on disk,
so it can be stopped and re-run at any point) and updates the rows.
Progress is committed every 200 rows.
"""
import argparse
import glob
import json
import os
import re
import urllib.parse
import sys

import psycopg2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import import_openlibrary as ol  # noqa: E402  (shares the cache, fetcher and cleaners)

PLACEHOLDER = r" book by .*\.$"
WRITER = re.compile(r"\b(author|writer|novelist|poet|playwright|dramatist|journalist|essayist|illustrator|historian|"
                    r"philosopher|screenwriter|biographer|columnist|cartoonist|translator|memoirist|editor|lyricist|"
                    r"theologian|critic|scholar|scientist|economist|psychologist|physician|professor)\b", re.I)


def key_maps():
    """Title -> work key and author name -> author key, from every cached search page."""
    works, authors = {}, {}
    for path in glob.glob(os.path.join(ol.CACHE_DIR, "*.json")):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, ValueError):
            continue
        if not isinstance(data, dict) or "docs" not in data:
            continue
        for doc in data["docs"]:
            title = (doc.get("title") or "").strip().lower()
            if title and doc.get("key"):
                works.setdefault(title, doc["key"])
            for name, akey in zip(doc.get("author_name", []), doc.get("author_key", [])):
                authors.setdefault(ol.norm_key(name), akey)
    return works, authors


def run(cur, conn, label, rows, url_for, apply, workers):
    todo = [(rid, url_for(key)) for rid, key in rows if key]
    print(f"{label}: {len(rows)} missing, {len(todo)} with an Open Library key", flush=True)
    done = filled = 0
    for start in range(0, len(todo), 200):
        chunk = todo[start:start + 200]
        fetched = ol.fetch_many([u for _, u in chunk], workers)
        for rid, url in chunk:
            if apply(rid, fetched.get(url) or {}):
                filled += 1
        conn.commit()
        done += len(chunk)
        print(f"  {label}: {done}/{len(todo)} checked, {filled} filled", flush=True)
    return filled


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--cache-only", action="store_true")
    parser.add_argument("--skip-books", action="store_true")
    parser.add_argument("--wikipedia", action="store_true", help="fall back to Wikipedia summaries for writers Open Library lacks")
    args = parser.parse_args()
    ol.CACHE_ONLY = args.cache_only

    works, author_keys = key_maps()
    print(f"Cached keys: {len(works)} works, {len(author_keys)} authors", flush=True)

    conn = psycopg2.connect(ol.DATABASE_URL)
    cur = conn.cursor()

    # 1. Real descriptions for books that only have the generated line
    if not args.skip_books:
        cur.execute("SELECT book_id, lower(title) FROM book WHERE description ~ %s AND length(description) < 200",
                    (PLACEHOLDER,))
        rows = [(bid, works.get(t)) for bid, t in cur.fetchall()]

        def apply_book(bid, work):
            text = ol.clean_text(work.get("description"))
            if not text or len(text) < 40:
                return False
            cur.execute("UPDATE book SET description = %s WHERE book_id = %s", (text, bid))
            return True

        run(cur, conn, "descriptions", rows, lambda k: f"https://openlibrary.org{k}.json", apply_book, args.workers)

    # 2. Bios and photos for authors that have neither
    cur.execute("SELECT author_id, name FROM author WHERE bio IS NULL OR photo_url IS NULL")
    rows = [(aid, author_keys.get(ol.norm_key(name))) for aid, name in cur.fetchall()]

    def apply_author(aid, info):
        bio = ol.clean_text(info.get("bio"), 800)
        photos = [p for p in info.get("photos", []) if isinstance(p, int) and p > 0]
        photo = f"https://covers.openlibrary.org/a/id/{photos[0]}-L.jpg" if photos else None
        if not bio and not photo:
            return False
        cur.execute("UPDATE author SET bio = COALESCE(bio, %s), photo_url = COALESCE(photo_url, %s) WHERE author_id = %s",
                    (bio, photo, aid))
        return True

    run(cur, conn, "authors", rows, lambda k: f"https://openlibrary.org/authors/{k}.json", apply_author, args.workers)

    # 3. Wikipedia fallback for authors Open Library knows nothing about.
    #    Only accepted when the page describes a writer, so a namesake isn't attached.
    if args.wikipedia:
        cur.execute("SELECT author_id, name FROM author WHERE bio IS NULL OR photo_url IS NULL")
        rows = [(aid, name) for aid, name in cur.fetchall()]
        wiki_url = lambda name: "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(name.replace(" ", "_"), safe="")

        def apply_wiki(aid, page):
            if page.get("type") != "standard":
                return False
            about = f"{page.get('description') or ''} {(page.get('extract') or '')[:300]}"
            if not WRITER.search(about):
                return False
            bio = ol.clean_text(page.get("extract"), 800)
            photo = (page.get("originalimage") or page.get("thumbnail") or {}).get("source")
            if not bio and not photo:
                return False
            cur.execute("UPDATE author SET bio = COALESCE(bio, %s), photo_url = COALESCE(photo_url, %s) WHERE author_id = %s",
                        (bio, photo, aid))
            return True

        run(cur, conn, "wikipedia", rows, wiki_url, apply_wiki, args.workers)

    # 4. Refresh the reporting views
    for mv in ("mv_most_read_books", "mv_active_users", "mv_genre_trends"):
        cur.execute(f"REFRESH MATERIALIZED VIEW {mv}")
    conn.commit()
    cur.execute("""SELECT (SELECT count(*) FROM book),
                          (SELECT count(*) FROM book WHERE description ~ %s AND length(description) < 200),
                          (SELECT count(*) FROM author), (SELECT count(*) FROM author WHERE bio IS NOT NULL),
                          (SELECT count(*) FROM author WHERE photo_url IS NOT NULL)""", (PLACEHOLDER,))
    b, ph, a, bio, photo = cur.fetchone()
    conn.close()
    print(f"Done. {b} books ({ph} still with a generated description); "
          f"{a} authors, {bio} with a bio, {photo} with a photo.")


if __name__ == "__main__":
    main()
