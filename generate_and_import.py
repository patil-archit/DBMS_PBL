import csv
import random
import os
from neo4j import GraphDatabase

# =========================================
# NEO4J CONNECTION DETAILS
# =========================================
URI = "bolt://localhost:7687"
USERNAME = "neo4j"
PASSWORD = "PLKoij#@1"
DATABASE_NAME = "bookgraph"

# =========================================
# SEED AND PROGRAMMATIC DATA GENERATION
# =========================================
random.seed(42)

# Real Series Seeds
harry_potter_books = [
    {"title": "Harry Potter and the Sorcerer's Stone", "subtitle": "Book 1", "authors": "J.K. Rowling", "categories": "Fantasy,Adventure,Magic,Young Adult", "published_year": 1997, "average_rating": 4.48, "num_pages": 309, "ratings_count": 7020000},
    {"title": "Harry Potter and the Chamber of Secrets", "subtitle": "Book 2", "authors": "J.K. Rowling", "categories": "Fantasy,Adventure,Magic,Young Adult", "published_year": 1998, "average_rating": 4.43, "num_pages": 341, "ratings_count": 2730000},
    {"title": "Harry Potter and the Prisoner of Azkaban", "subtitle": "Book 3", "authors": "J.K. Rowling", "categories": "Fantasy,Adventure,Magic,Young Adult,Time Travel", "published_year": 1999, "average_rating": 4.57, "num_pages": 435, "ratings_count": 2910000},
    {"title": "Harry Potter and the Goblet of Fire", "subtitle": "Book 4", "authors": "J.K. Rowling", "categories": "Fantasy,Adventure,Magic,Young Adult,Mystery", "published_year": 2000, "average_rating": 4.56, "num_pages": 734, "ratings_count": 2590000},
    {"title": "Harry Potter and the Order of the Phoenix", "subtitle": "Book 5", "authors": "J.K. Rowling", "categories": "Fantasy,Adventure,Magic,Young Adult,Dark", "published_year": 2003, "average_rating": 4.50, "num_pages": 870, "ratings_count": 2400000},
    {"title": "Harry Potter and the Half-Blood Prince", "subtitle": "Book 6", "authors": "J.K. Rowling", "categories": "Fantasy,Adventure,Magic,Young Adult,Dark,Mystery", "published_year": 2005, "average_rating": 4.58, "num_pages": 652, "ratings_count": 2290000},
    {"title": "Harry Potter and the Deathly Hallows", "subtitle": "Book 7", "authors": "J.K. Rowling", "categories": "Fantasy,Adventure,Magic,Young Adult,Dark,Action-packed", "published_year": 2007, "average_rating": 4.62, "num_pages": 759, "ratings_count": 2630000}
]

percy_jackson_books = [
    {"title": "The Lightning Thief", "subtitle": "Percy Jackson & the Olympians, Book 1", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult,Action-packed", "published_year": 2005, "average_rating": 4.25, "num_pages": 377, "ratings_count": 1950000},
    {"title": "The Sea of Monsters", "subtitle": "Percy Jackson & the Olympians, Book 2", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult", "published_year": 2006, "average_rating": 4.10, "num_pages": 279, "ratings_count": 680000},
    {"title": "The Titan's Curse", "subtitle": "Percy Jackson & the Olympians, Book 3", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult", "published_year": 2007, "average_rating": 4.22, "num_pages": 312, "ratings_count": 630000},
    {"title": "The Battle of the Labyrinth", "subtitle": "Percy Jackson & the Olympians, Book 4", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult,Action-packed", "published_year": 2008, "average_rating": 4.34, "num_pages": 361, "ratings_count": 600000},
    {"title": "The Last Olympian", "subtitle": "Percy Jackson & the Olympians, Book 5", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult,Action-packed", "published_year": 2009, "average_rating": 4.47, "num_pages": 381, "ratings_count": 620000},
    {"title": "The Lost Hero", "subtitle": "The Heroes of Olympus, Book 1", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult", "published_year": 2010, "average_rating": 4.33, "num_pages": 508, "ratings_count": 580000},
    {"title": "The Son of Neptune", "subtitle": "The Heroes of Olympus, Book 2", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult", "published_year": 2011, "average_rating": 4.41, "num_pages": 521, "ratings_count": 480000},
    {"title": "The Mark of Athena", "subtitle": "The Heroes of Olympus, Book 3", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult", "published_year": 2012, "average_rating": 4.44, "num_pages": 586, "ratings_count": 420000},
    {"title": "The House of Hades", "subtitle": "The Heroes of Olympus, Book 4", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult,Dark", "published_year": 2013, "average_rating": 4.54, "num_pages": 597, "ratings_count": 390000},
    {"title": "The Blood of Olympus", "subtitle": "The Heroes of Olympus, Book 5", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult,Action-packed", "published_year": 2014, "average_rating": 4.41, "num_pages": 516, "ratings_count": 340000},
    {"title": "The Hidden Oracle", "subtitle": "The Trials of Apollo, Book 1", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult", "published_year": 2016, "average_rating": 4.22, "num_pages": 376, "ratings_count": 180000},
    {"title": "The Dark Prophecy", "subtitle": "The Trials of Apollo, Book 2", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult", "published_year": 2017, "average_rating": 4.25, "num_pages": 414, "ratings_count": 120000},
    {"title": "The Burning Maze", "subtitle": "The Trials of Apollo, Book 3", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult,Dark", "published_year": 2018, "average_rating": 4.31, "num_pages": 431, "ratings_count": 110000},
    {"title": "The Tyrant's Tomb", "subtitle": "The Trials of Apollo, Book 4", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult", "published_year": 2019, "average_rating": 4.38, "num_pages": 448, "ratings_count": 90000},
    {"title": "The Tower of Nero", "subtitle": "The Trials of Apollo, Book 5", "authors": "Rick Riordan", "categories": "Fantasy,Adventure,Mythology,Greek Mythology,Young Adult,Action-packed", "published_year": 2020, "average_rating": 4.44, "num_pages": 502, "ratings_count": 85000}
]

agatha_christie_books = [
    {"title": "The Mysterious Affair at Styles", "subtitle": "Hercule Poirot #1", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Murder,Suspenseful", "published_year": 1920, "average_rating": 3.90, "num_pages": 196, "ratings_count": 120000},
    {"title": "The Secret Adversary", "subtitle": "Tommy & Tuppence #1", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Espionage,Suspenseful", "published_year": 1922, "average_rating": 3.82, "num_pages": 240, "ratings_count": 45000},
    {"title": "Murder on the Links", "subtitle": "Hercule Poirot #2", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Murder", "published_year": 1923, "average_rating": 3.88, "num_pages": 250, "ratings_count": 65000},
    {"title": "The Murder of Roger Ackroyd", "subtitle": "Hercule Poirot #4", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Murder,Locked Room,Mind-bending,Vividly Descriptive", "published_year": 1926, "average_rating": 4.26, "num_pages": 288, "ratings_count": 180000},
    {"title": "Murder at the Vicarage", "subtitle": "Miss Marple #1", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Murder,Cozy", "published_year": 1930, "average_rating": 4.05, "num_pages": 288, "ratings_count": 80000},
    {"title": "Murder on the Orient Express", "subtitle": "Hercule Poirot #10", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Murder,Locked Room,Suspenseful,Vividly Descriptive", "published_year": 1934, "average_rating": 4.18, "num_pages": 274, "ratings_count": 450000},
    {"title": "Death on the Nile", "subtitle": "Hercule Poirot #17", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Murder,Suspenseful,Vividly Descriptive", "published_year": 1937, "average_rating": 4.12, "num_pages": 288, "ratings_count": 220000},
    {"title": "And Then There Were None", "subtitle": "A Masterpiece of Mystery", "authors": "Agatha Christie", "categories": "Mystery,Thriller,Crime,Murder,Suspenseful,Dark,Locked Room,Vividly Descriptive", "published_year": 1939, "average_rating": 4.28, "num_pages": 272, "ratings_count": 1100000},
    {"title": "The ABC Murders", "subtitle": "Hercule Poirot #13", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Murder,Suspenseful", "published_year": 1936, "average_rating": 4.02, "num_pages": 256, "ratings_count": 95000},
    {"title": "Cards on the Table", "subtitle": "Hercule Poirot #15", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Murder", "published_year": 1936, "average_rating": 3.90, "num_pages": 288, "ratings_count": 42000},
    {"title": "Appointment with Death", "subtitle": "Hercule Poirot #19", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Murder", "published_year": 1938, "average_rating": 3.86, "num_pages": 303, "ratings_count": 24859},
    {"title": "Crooked House", "subtitle": "A Standalone Thriller", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Murder,Dark,Suspenseful", "published_year": 1949, "average_rating": 4.02, "num_pages": 224, "ratings_count": 55000},
    {"title": "A Murder is Announced", "subtitle": "Miss Marple #5", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Murder,Cozy", "published_year": 1950, "average_rating": 3.98, "num_pages": 382, "ratings_count": 68000},
    {"title": "Endless Night", "subtitle": "A Standalone Gothic Mystery", "authors": "Agatha Christie", "categories": "Mystery,Thriller,Dark,Gothic,Atmospheric", "published_year": 1967, "average_rating": 3.85, "num_pages": 224, "ratings_count": 25000},
    {"title": "Curtain: Poirot's Last Case", "subtitle": "Hercule Poirot #39", "authors": "Agatha Christie", "categories": "Mystery,Detective,Crime,Murder,Dark,Emotional", "published_year": 1975, "average_rating": 4.10, "num_pages": 224, "ratings_count": 35000}
]

# Pools for Generating Fictional Books
first_names = [
    "Alistair", "Evelyn", "Marcus", "Sylvia", "Cassandra", "Julian", "Seraphina", "Gideon", 
    "Elena", "Damian", "Valerie", "Arthur", "Isabella", "Lucas", "Rowan", "Amara", "Kaelen", 
    "Diana", "Victor", "Selina", "Harvey", "Oswald", "Pamela", "Jonathan", "Arthur", "Tricia", 
    "Ford", "Lyra", "Will", "Serafina", "Marisa", "Roger", "Cedric", "Garrick", "Sybill", 
    "Remus", "Severus", "Albus", "Minerva", "Rubeus", "Gilderoi", "Lucius", "Draco", "Bellatrix", 
    "Narcissa", "Regulus", "Sirius", "James", "Lily", "Petunia", "Vernon", "Dudley", "Gwen", 
    "Morgana", "Merlin", "Lancelot", "Guinevere", "Galahad", "Percival", "Rowena", "Helga", 
    "Godric", "Salazar"
]

last_names = [
    "Sterling", "Thorne", "Kane", "Vance", "Cross", "Stone", "Black", "Rostova", "Cole", 
    "Gallagher", "Hayes", "Pendelton", "Ash", "Drake", "Prince", "Wayne", "Fries", "Kyle", 
    "Nigma", "Dent", "Cobblepot", "Isley", "Crane", "McMillan", "Prefect", "Beeblebrox", 
    "Android", "Belacqua", "Parry", "Scoresby", "Pekkala", "Asriel", "Coulter", "Parslow", 
    "Diggory", "Ollivander", "Trelawney", "Lupin", "Snape", "Dumbledore", "McGonagall", 
    "Hagrid", "Lockhart", "Malfoy", "Lestrange", "Blackwood", "Potter", "Dursley", "Stacy", 
    "Pendragon", "le Fay", "Ravenclaw", "Hufflepuff", "Gryffindor", "Slytherin", "Gaunt", 
    "Riddle", "Peverell", "Carrow", "Yaxley", "Dolohov", "Macnair", "Rookwood", "Mulciber", 
    "Nott", "Crabbe", "Goyle", "Pansy", "Millicent", "Blaise", "Theodore", "Daphne", "Astoria"
]

adjectives = [
    "Crimson", "Silent", "Eternal", "Hidden", "Golden", "Shadowy", "Dark", "Last", "Forgotten", 
    "Ancient", "Burning", "Frozen", "Whispering", "Shattered", "Iron", "Glass", "Silver", 
    "Obsidian", "Celestial", "Velvet", "Haunted", "Broken", "Wandering", "Midnight", "Eldritch", 
    "Cursed", "Enchanted", "Vanish", "Lost", "Secret", "Fallen", "Stellar", "Lunar", "Solar", 
    "Deep", "Primal", "Mystic", "Vivid", "Deadly", "Veiled", "Spectral", "Sovereign"
]

nouns = [
    "Chronicles", "Legacy", "Prophecy", "Alliance", "Rebellion", "Labyrinth", "Empire", "Sovereign", 
    "Conspiracy", "Secret", "Whisper", "Echo", "Shadow", "Flame", "Storm", "Abyss", "Kingdom", 
    "Relic", "Curse", "Sanctuary", "Horizon", "Voyage", "Tomb", "Enigma", "Paradox", "Equation", 
    "Covenant", "Dawn", "Twilight", "Night", "Sentinel", "Oracle", "Mirror", "Gateway", "Citadel", 
    "Key", "Compass", "Map", "Riddle", "Crown", "Scepter", "Throne", "Blade", "Shield", "Heart", 
    "Soul", "Mind"
]

suffixes = [
    "of the Gods", "in the Shadows", "of Time", "under the Moon", "of the Abyss", "of the Cosmos", 
    "from the Past", "of the Empire", "of the Lost", "of the Forgotten", "of the Eternal", 
    "of the Night", "of the Sun", "of the Stars", "of the Sea", "of the Mountain", "of the Forest", 
    "of the Kingdom", "of the Sovereign", "of the Citadel", "of the Dark Room", "of the Silent Mind"
]

genre_tag_map = {
    "Sci-Fi": ["Mind-bending", "Time Travel", "Vividly Descriptive", "Dark", "Space Opera", "Artificial Intelligence", "Conspiracy", "Atmospheric"],
    "Fantasy": ["Epic", "Atmospheric", "Vividly Descriptive", "Magic", "Mythology", "Supernatural", "High Fantasy", "Action-packed"],
    "Mystery": ["Murder", "Suspenseful", "Mysterious", "Noir", "Detective", "Locked Room", "Conspiracy", "Gothic", "Dark"],
    "Thriller": ["Murder", "Suspenseful", "Action-packed", "Conspiracy", "Intense", "Fast-paced", "Dark", "Espionage"],
    "Horror": ["Dark", "Atmospheric", "Supernatural", "Intense", "Eerie", "Gothic", "Psychological"],
    "Romance": ["Emotional", "Character-driven", "Atmospheric", "Cozy", "Drama"],
    "Dystopian": ["Dark", "Atmospheric", "Philosophical", "Conspiracy", "Dystopian", "Character-driven"],
    "Historical Fiction": ["Atmospheric", "Vividly Descriptive", "Drama", "Character-driven", "Philosophical"],
    "Cyberpunk": ["Dark", "Cyberpunk", "Artificial Intelligence", "Mind-bending", "Action-packed", "Noir"],
    "Adventure": ["Action-packed", "Epic", "Fast-paced", "Vividly Descriptive"]
}

# Generate 150 unique author names
fictional_authors = []
while len(fictional_authors) < 150:
    name = f"{random.choice(first_names)} {random.choice(last_names)}"
    if name not in fictional_authors and name not in ["J.K. Rowling", "Rick Riordan", "Agatha Christie"]:
        fictional_authors.append(name)

# Helper to generate unique book titles
generated_titles = set()
for b in harry_potter_books + percy_jackson_books + agatha_christie_books:
    generated_titles.add(b["title"])

def generate_unique_title(genre, author):
    # Special thematic templates for certain authors
    if author == "Agatha Christie" or genre == "Mystery":
        templates = [
            "The Mystery of the {adj} {noun}",
            "Death in the {adj} {noun}",
            "Murder at {adj} {noun}",
            "The {adj} {noun} Murder",
            "The Case of the {adj} {noun}",
            "A Study in {adj}",
            "The Locked Room of {noun}"
        ]
        for _ in range(50):
            t = random.choice(templates).format(adj=random.choice(adjectives), noun=random.choice(nouns))
            if t not in generated_titles:
                generated_titles.add(t)
                return t
    
    if author == "J.K. Rowling" or author == "Rick Riordan" or genre == "Fantasy":
        templates = [
            "The {adj} {noun} and the {noun}",
            "The Curse of the {adj} {noun}",
            "Chronicles of the {adj} {noun}",
            "The Legacy of {noun}"
        ]
        for _ in range(50):
            t = random.choice(templates).format(adj=random.choice(adjectives), noun=random.choice(nouns))
            if t not in generated_titles:
                generated_titles.add(t)
                return t

    while True:
        adj = random.choice(adjectives)
        noun = random.choice(nouns)
        suff = random.choice(suffixes) if random.random() < 0.6 else ""
        if suff:
            title = f"The {adj} {noun} {suff}"
        else:
            title = f"{adj} {noun}"
            if random.random() < 0.3:
                title = f"The {title}"
        
        if title not in generated_titles:
            generated_titles.add(title)
            return title

def generate_vivid_description(title, author, genre, tags):
    settings = [
        "a dystopian city ruled by a corporate elite", 
        "a forgotten planet on the edge of the galaxy", 
        "a secluded mansion hidden in the misty mountains", 
        "an ancient kingdom threatened by dark magic", 
        "the bustling streets of a neon-drenched metropolis", 
        "a quiet New England town harboring a dark secret", 
        "a mysterious space station orbiting a dying star", 
        "the ruins of a long-lost civilization", 
        "a medieval village where legends come to life",
        "a locked room where a wealthy heir has met their sudden demise"
    ]
    conflicts = [
        "the sudden disappearance of a prominent scholar", 
        "the discovery of a strange artifact of immense power", 
        "a series of brutal murders that mimic ancient folklore", 
        "a conspiracy that reaches the highest levels of power", 
        "a rupture in the space-time continuum", 
        "an impending war between rival houses", 
        "a forbidden romance that threatens to tear two worlds apart", 
        "a mysterious curse that begins to spread among the populace",
        "a brilliant detective being challenged to solve the perfect crime"
    ]
    climaxes = [
        "unravels a truth that could shatter reality itself", 
        "leads to a desperate race against time to save humanity", 
        "forces a broken hero to confront their deepest fears", 
        "ignites a revolution that will change the course of history", 
        "uncovers a shocking betrayal from within", 
        "leads to a final confrontation where the fate of the world hangs in the balance"
    ]
    
    setting = random.choice(settings)
    conflict = random.choice(conflicts)
    climax = random.choice(climaxes)
    
    desc = f"In {title}, a gripping {genre} novel by {author}, readers are taken to {setting}. When {conflict} occurs, it {climax}. "
    desc += f"Vividly descriptive and filled with atmospheric suspense, this story explores themes of {', '.join(tags[:3])}."
    return desc

# Assemble books list
books = []
books.extend(harry_potter_books)
books.extend(percy_jackson_books)
books.extend(agatha_christie_books)

# Fictional book counts to hit 3500+
# Let's add extra books for the core series authors to meet user requirement:
# - Agatha Christie gets 45 additional mystery novels
for _ in range(45):
    title = generate_unique_title("Mystery", "Agatha Christie")
    tags_pool = genre_tag_map["Mystery"]
    selected_tags = random.sample(tags_pool, k=min(4, len(tags_pool)))
    categories = list(set(["Mystery", "Detective", "Murder"] + selected_tags))
    desc = generate_vivid_description(title, "Agatha Christie", "Mystery", categories)
    books.append({
        "title": title,
        "subtitle": f"A Classic Detective Novel",
        "authors": "Agatha Christie",
        "categories": ",".join(categories),
        "published_year": random.randint(1925, 1974),
        "average_rating": round(random.uniform(3.8, 4.5), 2),
        "num_pages": random.randint(180, 350),
        "ratings_count": random.randint(5000, 150000)
    })

# - J.K. Rowling gets 5 additional fantasy novels
for _ in range(5):
    title = generate_unique_title("Fantasy", "J.K. Rowling")
    tags_pool = genre_tag_map["Fantasy"]
    selected_tags = random.sample(tags_pool, k=min(4, len(tags_pool)))
    categories = list(set(["Fantasy", "Magic", "Young Adult"] + selected_tags))
    desc = generate_vivid_description(title, "J.K. Rowling", "Fantasy", categories)
    books.append({
        "title": title,
        "subtitle": "A Tales of Magic",
        "authors": "J.K. Rowling",
        "categories": ",".join(categories),
        "published_year": random.randint(2008, 2021),
        "average_rating": round(random.uniform(4.0, 4.6), 2),
        "num_pages": random.randint(300, 600),
        "ratings_count": random.randint(10000, 500000)
    })

# - Rick Riordan gets 10 additional adventure/mythology novels
for _ in range(10):
    title = generate_unique_title("Fantasy", "Rick Riordan")
    tags_pool = genre_tag_map["Fantasy"]
    selected_tags = random.sample(tags_pool, k=min(4, len(tags_pool)))
    categories = list(set(["Fantasy", "Adventure", "Mythology", "Greek Mythology"] + selected_tags))
    desc = generate_vivid_description(title, "Rick Riordan", "Fantasy", categories)
    books.append({
        "title": title,
        "subtitle": "An Olympian Adventure",
        "authors": "Rick Riordan",
        "categories": ",".join(categories),
        "published_year": random.randint(2010, 2025),
        "average_rating": round(random.uniform(4.1, 4.6), 2),
        "num_pages": random.randint(350, 550),
        "ratings_count": random.randint(15000, 300000)
    })

# Now generate the rest of the 3500+ books from the general author and genre pool
total_target = 3550
while len(books) < total_target:
    author = random.choice(fictional_authors)
    genre = random.choice(list(genre_tag_map.keys()))
    
    # Title
    title = generate_unique_title(genre, author)
    
    # Subtitle
    subtitle = ""
    if random.random() < 0.4:
        subtitle = f"Book {random.randint(1, 5)} of the {title.split(' ')[-1]} Series"
    
    # Categories & Tags
    # Pick primary genre, maybe secondary genre, and tags
    categories_list = [genre]
    if random.random() < 0.3:
        sec_genre = random.choice(list(genre_tag_map.keys()))
        if sec_genre != genre:
            categories_list.append(sec_genre)
            
    # Draw tags from selected genres
    tags_pool = []
    for g in categories_list:
        tags_pool.extend(genre_tag_map[g])
    tags_pool = list(set(tags_pool))
    
    # Sample tags
    num_tags = random.randint(2, 4)
    selected_tags = random.sample(tags_pool, k=min(num_tags, len(tags_pool)))
    
    # Combine genres and tags
    all_categories = list(set(categories_list + selected_tags))
    categories_str = ",".join(all_categories)
    
    books.append({
        "title": title,
        "subtitle": subtitle,
        "authors": author,
        "categories": categories_str,
        "published_year": random.randint(1920, 2026),
        "average_rating": round(random.uniform(3.5, 4.9), 2),
        "num_pages": random.randint(150, 850),
        "ratings_count": random.randint(100, 120000)
    })

# Add ISBNs and Descriptions, and finalize the format
isbn13_start = 9781000000000
isbn10_start = 1000000000

for index, book in enumerate(books):
    book["isbn13"] = str(isbn13_start + index)
    book["isbn10"] = f"{isbn10_start + index:010d}"
    book["thumbnail"] = ""
    
    # Description if not set
    if "description" not in book:
        categories_list = book["categories"].split(",")
        genre = categories_list[0]
        tags = categories_list[1:] if len(categories_list) > 1 else [genre]
        book["description"] = generate_vivid_description(book["title"], book["authors"], genre, tags)

print(f"Generated {len(books)} books total.")

# =========================================
# WRITE TO CSV (data.csv)
# =========================================
csv_headers = ["isbn13", "isbn10", "title", "subtitle", "authors", "categories", "thumbnail", "description", "published_year", "average_rating", "num_pages", "ratings_count"]
csv_file_path = "data.csv"

with open(csv_file_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=csv_headers)
    writer.writeheader()
    for book in books:
        writer.writerow(book)

print(f"Saved dataset to {os.path.abspath(csv_file_path)}")

# =========================================
# IMPORT TO NEO4J
# =========================================
print("\nConnecting to Neo4j...")
driver = GraphDatabase.driver(URI, auth=(USERNAME, PASSWORD))

try:
    with driver.session(database=DATABASE_NAME) as session:
        # 1. Clear database
        print("Clearing all existing data from 'bookgraph' database...")
        session.run("MATCH (n) DETACH DELETE n")
        print("Database cleared.")

        # 2. Ingest books in batches
        print("Importing books...")
        batch_size = 200
        
        # Prepare data for import
        import_list = []
        for book in books:
            import_list.append({
                "title": book["title"],
                "subtitle": book.get("subtitle", ""),
                "description": book.get("description", ""),
                "thumbnail": book.get("thumbnail", ""),
                "published_year": int(book["published_year"]),
                "average_rating": float(book["average_rating"]),
                "num_pages": int(book["num_pages"]),
                "ratings_count": int(book["ratings_count"]),
                "isbn13": book["isbn13"],
                "isbn10": book["isbn10"],
                "authors": [a.strip() for a in book["authors"].split(",") if a.strip()],
                "categories": [c.strip() for c in book["categories"].split(",") if c.strip()]
            })

        import_query = """
        UNWIND $batch AS row
        MERGE (b:Book {title: row.title})
        SET b.subtitle = row.subtitle,
            b.description = row.description,
            b.thumbnail = row.thumbnail,
            b.published_year = row.published_year,
            b.average_rating = row.average_rating,
            b.num_pages = row.num_pages,
            b.ratings_count = row.ratings_count,
            b.isbn13 = row.isbn13,
            b.isbn10 = row.isbn10

        WITH b, row
        UNWIND row.authors AS author_name
        MERGE (a:Author {name: author_name})
        MERGE (b)-[:WRITTEN_BY]->(a)

        WITH b, row
        UNWIND row.categories AS category_name
        MERGE (c:Category {name: category_name})
        MERGE (b)-[:HAS_CATEGORY]->(c)
        """

        for i in range(0, len(import_list), batch_size):
            batch = import_list[i:i+batch_size]
            session.run(import_query, parameters={"batch": batch})
            print(f"Imported {i + len(batch)} / {len(import_list)} books...")

        # 3. Print counts to verify
        print("\nVerifying imported counts...")
        b_count = session.run("MATCH (b:Book) RETURN count(b) as count").single()["count"]
        a_count = session.run("MATCH (a:Author) RETURN count(a) as count").single()["count"]
        c_count = session.run("MATCH (c:Category) RETURN count(c) as count").single()["count"]
        r_count = session.run("MATCH ()-[r]->() RETURN count(r) as count").single()["count"]
        
        print(f"Books in DB: {b_count}")
        print(f"Authors in DB: {a_count}")
        print(f"Categories/Tags in DB: {c_count}")
        print(f"Relationships in DB: {r_count}")

    print("\nIMPORT COMPLETED SUCCESSFULLY!")

except Exception as e:
    print(f"\nAn error occurred during import: {e}")
finally:
    driver.close()
