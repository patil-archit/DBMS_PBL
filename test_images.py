import requests
import json

def get_main_page_image(title):
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "format": "json",
        "prop": "pageimages",
        "piprop": "original",
        "titles": title,
        "redirects": 1
    }
    headers = {
        "User-Agent": "DAABookSystem/1.0 (test@example.com)"
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=5)
        data = response.json()
        pages = data.get("query", {}).get("pages", {})
        for page_id in pages:
            page = pages[page_id]
            if "original" in page:
                return page["original"]["source"]
    except Exception as e:
        print(f"Error fetching {title}: {e}")
    return None

test_items = [
    "Jane Austen", 
    "Herman Melville", 
    "George Orwell", 
    "Pride and Prejudice", 
    "Moby-Dick", 
    "Nineteen Eighty-Four", 
    "To Kill a Mockingbird",
    "The Great Gatsby"
]

print("Fetching main images:")
for item in test_items:
    img = get_main_page_image(item)
    print(f"{item}: {img}")
