import os
import shutil
import re
import csv

female_authors = {
    'Sylvia Plath', 'Daphne du Maurier', 'Hilary Mantel', 'Frances Hodgson Burnett', 
    'Barbara Kingsolver', 'Ursula K. Le Guin', 'Alice Walker', 'Virginia Woolf', 
    'Margaret Atwood', 'Iris Murdoch', 'George Eliot', 'Harper Lee', 'Toni Morrison', 
    'Jean Rhys', 'Zora Neale Hurston', 'Mary Shelley', 'Arundhati Roy', 'Emily Brontë', 
    'Louisa May Alcott', 'Margaret Mitchell', 'Edith Wharton', 'Charlotte Brontë', 
    'Jane Austen', 'A.S. Byatt'
}

male_img_path = '/Users/archit/.gemini/antigravity-ide/brain/6f4908e2-902b-4686-976e-0435a2c19d57/generic_male_author_1779987774657.png'
female_img_path = '/Users/archit/.gemini/antigravity-ide/brain/6f4908e2-902b-4686-976e-0435a2c19d57/agatha_christie_1779979984748.png'
dest_dir = '/Users/archit/Documents/DAA_Book_Recommendation_System/frontend/public/authors'

if not os.path.exists(dest_dir):
    os.makedirs(dest_dir)

authors = set()
with open("/Users/archit/Documents/DAA_Book_Recommendation_System/master_curated_books_universe_180.csv", "r", encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    for row in reader:
        val = row.get("Author:name", "").strip()
        for a in val.split(","):
            if a.strip():
                authors.add(a.strip())

for author in authors:
    safe_name = author.lower()
    safe_name = re.sub(r'[^a-z0-9\s]', '', safe_name)
    safe_name = "_".join(safe_name.split())
    
    img_path = female_img_path if author in female_authors else male_img_path
    dest_path = os.path.join(dest_dir, f"{safe_name}.png")
    
    if not os.path.exists(dest_path):
        shutil.copy2(img_path, dest_path)
        print(f"Copied image for {author} -> {safe_name}.png")

print("All author images processed.")
