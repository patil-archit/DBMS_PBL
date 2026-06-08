import os
import glob
import re

def get_actual_image_url(author_name: str) -> str:
    safe_name = author_name.lower()
    safe_name = re.sub(r'[^a-z0-9\s]', '', safe_name)
    safe_name = "_".join(safe_name.split())
    
    # Trace dir
    file_path = "/Users/archit/Documents/DAA_Book_Recommendation_System/backend/app/services/neo4j_service.py"
    dir_1 = os.path.dirname(os.path.abspath(file_path))
    dir_2 = os.path.dirname(dir_1)
    dir_3 = os.path.dirname(dir_2)
    dir_4 = os.path.dirname(dir_3)
    
    print(f"Dir 1 (services): {dir_1}")
    print(f"Dir 2 (app): {dir_2}")
    print(f"Dir 3 (backend): {dir_3}")
    print(f"Dir 4 (workspace root): {dir_4}")
    
    public_authors_dir = os.path.join(dir_4, "frontend", "public", "authors")
    print(f"Target Public Directory: {public_authors_dir}")
    
    # Check if exists
    print(f"Directory exists? {os.path.exists(public_authors_dir)}")
    
    # List files
    search_pattern = os.path.join(public_authors_dir, f"{safe_name}.*")
    matching_files = glob.glob(search_pattern)
    print(f"Search Pattern: {search_pattern}")
    print(f"Matching Files: {matching_files}")

get_actual_image_url("J.K. Rowling")
