import os
import re
import time
import requests
from neo4j import GraphDatabase

# Neo4j configuration
URI = "bolt://localhost:7687"
USERNAME = "neo4j"
PASSWORD = "PLKoij#@1"
DATABASE_NAME = "bookgraph"

# MediaWiki Action API setup
API_URL = "https://en.wikipedia.org/w/api.php"
HEADERS = {
    "User-Agent": "DAABookSystem/1.0 (test@example.com)"
}

def get_main_page_image(title):
    params = {
        "action": "query",
        "format": "json",
        "prop": "pageimages",
        "piprop": "original",
        "titles": title,
        "redirects": 1
    }
    try:
        response = requests.get(API_URL, params=params, headers=HEADERS, timeout=5)
        if response.status_code == 200:
            data = response.json()
            pages = data.get("query", {}).get("pages", {})
            for page_id in pages:
                page = pages[page_id]
                if "original" in page:
                    return page["original"]["source"]
    except Exception as e:
        print(f"Error checking Wikipedia pageimage for {title}: {e}")
    return None

def download_image(url, dest_path):
    browser_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive"
    }
    try:
        response = requests.get(url, headers=browser_headers, stream=True, timeout=10)
        if response.status_code == 200:
            with open(dest_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
        else:
            print(f"Failed to download from {url}: Status code {response.status_code}")
    except Exception as e:
        print(f"Error downloading image from {url}: {e}")
    return False

def get_author_image_url(name):
    return get_main_page_image(name)

def get_book_image_url(title):
    # Special manual mapping for known ambiguous titles
    mappings = {
        "1984": "Nineteen Eighty-Four"
    }
    search_title = mappings.get(title, title)
    
    # Try exact title first
    url = get_main_page_image(search_title)
    if not url:
        # Try appending "(novel)"
        url = get_main_page_image(f"{search_title} (novel)")
    if not url:
        # Try appending "(book)"
        url = get_main_page_image(f"{search_title} (book)")
    return url

# Base directory for authors
dest_dir = "/Users/archit/Documents/DAA_Book_Recommendation_System/frontend/public/authors"
if not os.path.exists(dest_dir):
    os.makedirs(dest_dir)

print("Connecting to Neo4j...")
driver = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))

try:
    with driver.session(database=DATABASE_NAME) as session:
        
        # ==========================================
        # 1. ENRICH AUTHORS (ONLY UNENRICHED)
        # ==========================================
        print("\nFetching Unenriched Authors...")
        authors_query = """
        MATCH (a:Author) 
        WHERE a.image_url IS NULL OR NOT a.image_url STARTS WITH 'https://upload.wikimedia.org'
        RETURN a.name AS name
        """
        authors = [record["name"] for record in session.run(authors_query)]
        
        print(f"Found {len(authors)} unenriched authors to process.")
        author_success_count = 0
        
        for name in authors:
            safe_name = name.lower()
            safe_name = re.sub(r'[^a-z0-9\s]', '', safe_name)
            safe_name = "_".join(safe_name.split())
            
            img_url = get_author_image_url(name)
            if img_url:
                ext = os.path.splitext(img_url)[1].lower()
                if ext not in ['.jpg', '.jpeg', '.png', '.webp']:
                    ext = '.jpg'
                
                dest_path = os.path.join(dest_dir, f"{safe_name}{ext}")
                
                # Delete any other existing extensions for this author first so we don't have multiple extensions
                for possible_ext in ['.png', '.jpg', '.jpeg', '.webp']:
                    old_file = os.path.join(dest_dir, f"{safe_name}{possible_ext}")
                    if os.path.exists(old_file):
                        try:
                            os.remove(old_file)
                        except Exception:
                            pass
                
                print(f"Downloading portrait for {name}...")
                if download_image(img_url, dest_path):
                    author_success_count += 1
                    # Also update database URL property
                    session.run("MATCH (a:Author {name: $name}) SET a.image_url = $url", name=name, url=img_url)
                
                # Dynamic delay to respect Wikipedia rate limits and prevent 429 errors
                time.sleep(1.0)
            else:
                print(f"No Wikipedia image found for author: {name}")
                time.sleep(0.1)
                
        print(f"Successfully enriched {author_success_count} new authors with real portrait images.")
        
        # ==========================================
        # 2. ENRICH BOOKS (DISABLED PER USER REQUEST)
        # ==========================================
        print("\n[DISABLED] Wikipedia book cover enrichment has been disabled per user request.")
        
except Exception as e:
    print(f"Error during image enrichment: {e}")
finally:
    driver.close()

print("\nIncremental Image enrichment process finished!")
