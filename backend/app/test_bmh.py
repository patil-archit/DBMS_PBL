import sys
import os

# Add parent directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.search.bmh_search import AdvancedBMHSearch, normalize_text

def run_tests():
    print("=== STARTING ADVANCED BMH ALGORITHM TESTS ===")
    
    # 1. Test Text Normalization
    print("\n1. Testing Text Normalization:")
    inputs = ["Agatha Christie!", "Härry Pötter", "The Da Vinci Code (Robert Langdon #2)"]
    for inp in inputs:
        print(f"  Raw: '{inp}' -> Normalized: '{normalize_text(inp)}'")
    
    # 2. Test exact BMH Match
    print("\n2. Testing Exact BMH Match:")
    text = normalize_text("Harry Potter and the Sorcerer's Stone")
    pattern = normalize_text("potter")
    matches = AdvancedBMHSearch.search_token(text, pattern)
    print(f"  Searching '{pattern}' in '{text}'")
    print(f"  Matches: {matches} (Expected: 1 match with 0 mismatches)")
    
    # 3. Test k-mismatch approximate search
    print("\n3. Testing Boyer-Moore-Horspool with k-mismatches:")
    # "agtha" has 1 deletion/change relative to "agatha"
    text = normalize_text("Agatha Christie's Detective Novel")
    
    # Search short token (exact)
    matches_short = AdvancedBMHSearch.search_token(text, "agt")
    print(f"  Searching short token 'agt' (exact check only): Matches: {matches_short}")
    
    # Search medium token (allowed k=1)
    matches_med1 = AdvancedBMHSearch.search_token(text, "agtha")
    print(f"  Searching medium 'agtha' in '{text}' (allows k=1 mismatch): Matches: {matches_med1}")
    
    # Search medium token with too many errors (allows k=1, we give 2 errors: "agthx")
    matches_med2 = AdvancedBMHSearch.search_token(text, "agthx")
    print(f"  Searching 'agthx' (allows k=1, has 2 errors): Matches: {matches_med2}")

    # 4. Test scoring field
    print("\n4. Testing Scoring Logic:")
    title = "Harry Potter and the Goblet of Fire"
    query = "harry pottr" # 1 typo in potter ("pottr" -> "potter", length 5, allowed k=1)
    tokens = normalize_text(query).split()
    score, matched = AdvancedBMHSearch.score_field(title, tokens, 100.0)
    print(f"  Query: '{query}' -> Title: '{title}'")
    print(f"  Result Score: {score}, Matched Tokens: {matched}")
    
    # 5. Test multi-entity search integration
    print("\n5. Testing Search Entities Aggregator:")
    books = [
        {"title": "Harry Potter and the Goblet of Fire", "average_rating": 4.56, "authors": ["J.K. Rowling"], "categories": ["Fantasy"]},
        {"title": "Dune", "average_rating": 4.7, "authors": ["Frank Herbert"], "categories": ["Sci-Fi"]}
    ]
    authors = [
        {"name": "J.K. Rowling", "book_count": 11},
        {"name": "Frank Herbert", "book_count": 8}
    ]
    categories = [
        {"name": "Fantasy", "book_count": 24},
        {"name": "Sci-Fi", "book_count": 15}
    ]
    
    res = AdvancedBMHSearch.search_entities("rowling fantasy", books, authors, categories)
    print("\nSearch results for 'rowling fantasy':")
    print("  Books matched:")
    for b in res["books"]:
        print(f"    - '{b['title']}' (Score: {b['score']})")
    print("  Authors matched:")
    for a in res["authors"]:
        print(f"    - '{a['name']}' (Score: {a['score']})")
    print("  Genres matched:")
    for g in res["genres"]:
        print(f"    - '{g['name']}' (Score: {g['score']})")

    print("\n=== ALL TESTS COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_tests()
