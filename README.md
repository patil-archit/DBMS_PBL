# 📚 GraphBooks: Full-Stack Graph-Based Book Recommendation & Pathfinder System

GraphBooks is an intelligent, high-performance, and visually stunning book search and recommendation platform. At its core, the project is a deep exploration of **Design and Analysis of Algorithms (DAA)**. It maps complex, multi-dimensional literary relationships (books, authors, categories) into a **Neo4j Graph Database** containing thousands of nodes and relationships, querying them through a high-concurrency **FastAPI backend** and displaying them using a modern, interactive **React + Vite + Tailwind CSS** frontend featuring a **3D Real-Time Graph Pathfinder Simulator**.

---

## 🚀 System Architecture Overview

GraphBooks is designed with a highly decoupled, future-ready architecture:

```
                  ┌─────────────────────────────────────────┐
                  │          React + Vite Frontend          │
                  │   (Glassmorphic Dark-Mode / Brutalist)  │
                  └────────────────────┬────────────────────┘
                                       │
                        JSON REST API  │  Axios HTTP Client
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │             FastAPI Backend             │
                  │     (Routing, Pydantic, Middleware)     │
                  └──────┬───────────────────────────┬──────┘
                         │                           │
                         │ Dynamic TTL Cache         │ Cypher Queries
                         ▼                           ▼
            ┌────────────────────────┐   ┌────────────────────────┐
            │   In-Memory Cache      │   │  Neo4j Graph Database  │
            │   (BMH Candidates)     │   │   (3,500+ Book Nodes)  │
            └────────────────────────┘   └────────────────────────┘
```

1. **Database Layer (Neo4j Graph)**: Stores real-world data structured naturally as a graph. It holds over **10,000+ nodes** and **13,000+ relationships**:
   * **Nodes**: `Book`, `Author`, `Category`, `User`.
   * **Relationships**: 
     * `(Book)-[:WRITTEN_BY]->(Author)`
     * `(Book)-[:HAS_CATEGORY]->(Category)`
     * `(User)-[:ADDED_TO_LIBRARY]->(Book)`
     * `(User)-[:FOLLOWS]->(Author)`
2. **Backend Services (FastAPI)**: Manages authentication (Firebase Admin SDK), serves structured APIs, implements a dynamic Time-To-Live (TTL) cache system, and executes clean Cypher query operations.
3. **Frontend Presentation (React + Three.js)**: Utilizes a brutalist dark-mode design system with custom components. Integrates **`react-force-graph-3d`** and **`Three.js`** to render real-time, interactive, three-dimensional physical force-directed models of the book database for pathfinder simulations.

---

## 🧮 Algorithmic Deep Dive & Custom Enhancements

This project places a massive emphasis on implementing, adapting, and modifying classic computer science algorithms for real-world application needs. Below is a comprehensive breakdown of the core algorithms driving GraphBooks.

---

### 1. Advanced Boyer-Moore-Horspool (BMH) String Searching
#### 🔍 The Concept
The Boyer-Moore-Horspool (BMH) algorithm is an optimization of the classic Boyer-Moore string-matching algorithm. It is used to find occurrences of a template pattern string $P$ of length $m$ within a text body $T$ of length $n$. 

While naive string searching checks every single character alignment sequentially ($O(n \times m)$ worst-case), BMH scans the pattern from **right to left** starting from the end of the pattern, and uses a precomputed **Bad Character Shift Table** to skip large blocks of text upon finding a mismatch. This yields an average-case time complexity of:

$$\Theta\left(\frac{n}{m}\right)$$

#### 🛠️ Our Project Adaptation: Dynamic $k$-Mismatches & Multi-Field Weighted Scoring
Standard BMH is designed for exact string searches and struggles with human input errors (typos). In [bmh_search.py](file:///Users/archit/Documents/DAA_Book_Recommendation_System/backend/app/search/bmh_search.py), we modified the BMH search engine to support **approximate fuzzy matching** via **Dynamic $k$-Mismatches** and combined it with an intricate **Multi-Field Weighted Scoring** algorithm:

1. **Dynamic $k$-Mismatch Thresholding**:
   Depending on the length of the query token ($m$), the algorithm dynamically determines the number of allowed character mismatches ($k$) before rejecting a match:
   * **Long Tokens ($m \ge 7$)**: Allows up to 2 mismatches ($k = 2$) to account for multiple spelling mistakes.
   * **Medium Tokens ($7 > m \ge 4$)**: Allows up to 1 mismatch ($k = 1$).
   * **Short Tokens ($m < 4$)**: Forces exact matching ($k = 0$) to avoid cluttering results with high-frequency noise.

2. **The $k$-Mismatch Skip Traversal Loop**:
   Instead of terminating immediately on a single mismatch, the loop tracks a running `mismatches` count. It only breaks if `mismatches > k`. The pointer still shifts using the standard bad character shift table relative to the last aligned character in the text.

```python
# dynamic mismatch loop in bmh_search.py
while i <= n - m:
    mismatches = 0
    j = m - 1
    while j >= 0:
        if text[i + j] != pattern[j]:
            mismatches += 1
            if mismatches > k:
                break
        j -= 1
    
    if j < 0:
        matches.append((i, mismatches))
    
    # Shift using the bad character shift table of BMH
    last_char = text[i + m - 1]
    i += max(1, shift.get(last_char, m))
```

3. **Multi-Field Weighted Scoring Formulation**:
   Search is performed across five text fields with different relevance weights ($W_f$):
   * **Title**: $W_{\text{title}} = 100.0$
   * **Author Names**: $W_{\text{authors}} = 80.0$
   * **Categories / Genres**: $W_{\text{categories}} = 50.0$
   * **Subtitle**: $W_{\text{subtitle}} = 40.0$
   * **Description**: $W_{\text{description}} = 15.0$

   For each field, the score is penalized for typos and boosted using precise linguistic rules:
   * **Typo Penalty**: $P_{\text{typo}} = 1.0 - (\text{mismatches} \times 0.2)$.
   * **Word Boundary Bonus ($B_{\text{boundary}} = 1.2$)**: Applied if the match occurs at the start of a word.
   * **Exact Word Bonus ($B_{\text{exact}} = 1.3$)**: Applied if the match matches a full standalone word exactly.
   * **Positional Decay Bonus ($B_{\text{position}}$)**: Gives higher relevance to matches appearing closer to the beginning of the text:
     $$B_{\text{position}} = 1.0 + 0.1 \times \max\left(0.5, 1.0 - \frac{\text{start\_index}}{\text{field\_length}}\right)$$
   * **Multi-Token Match Bonus**: If a user submits $T$ tokens, and all $T$ tokens are found across a book's fields, the final composite score is multiplied by **$1.5\times$**.
   * **Quality Boost**: Scores are boosted by a factor proportional to the book's global rating to surface higher quality results first:
     $$\text{Final Boosted Score} = \text{Score} \times \left(1.0 + \frac{\text{average\_rating}}{10.0}\right)$$

---

### 2. Breadth-First Search (BFS) Pathfinder Traversal
#### 🔍 The Concept
Breadth-First Search is a fundamental graph traversal algorithm that explores all vertices at the current depth level before moving to vertices at the next depth level. It utilizes a **Queue (First-In, First-Out - FIFO)** to manage the discovery frontier. It guarantees finding the shortest path (in terms of edge count) between any two nodes in an unweighted graph. The time complexity is:

$$O(V + E)$$

where $V$ is the number of vertices and $E$ is the number of edges.

```
                      [Start Node]
                       /    |     \
                    (Lev 1)(Lev 1)(Lev 1)
                     /   \    |     /  \
                   (L2)  (L2)(L2) (L2) (L2)
```

#### 🛠️ Our Project Adaptation: Deterministic Alphabetical Neighbor Expansion
In [neo4j_service.py](file:///Users/archit/Documents/DAA_Book_Recommendation_System/backend/app/services/neo4j_service.py), BFS is executed in memory over the dynamically loaded graph database schema (containing books, authors, and genres). We modified the traditional BFS traversal to achieve **consistent, reproducible, and deterministic paths** suitable for visual animation:

1. **Undirected Bi-Directional Adjacency Modeling**:
   Although Neo4j relationships are directed (e.g., `Book -[:WRITTEN_BY]-> Author`), we construct an **undirected adjacency list representation** at runtime. This allows traversals to seamlessly flow "backward" (e.g., from an Author back to their other Books, and from Categories back to all Books belonging to them).
2. **Alphabetical Sorting Constraint**:
   To ensure the simulation traverses the graph deterministically, we sort neighbor nodes alphabetically by their identifier/title before pushing them to the queue:
   $$\text{Queue} \leftarrow \text{sort\_alphabetically}(\text{Unvisited Neighbors})$$
3. **Double Spanning Tree Tracker**:
   In addition to maintaining a standard `visited` set to prevent cycles, our BFS tracks both `visited_nodes` (the order of discovery) and `visited_edges` (linking source and target nodes). This allows the frontend to draw the exact **Breadth-First Search Spanning Tree** dynamically in 3D.

---

### 3. Depth-First Search (DFS) Pathfinder Traversal
#### 🔍 The Concept
Depth-First Search is a graph traversal algorithm that explores as deep as possible along each branch before backtracking. It uses a **Stack (Last-In, First-Out - LIFO)** or recursion to manage the frontier. It is highly efficient in terms of memory when searching deep paths, with a time complexity of:

$$O(V + E)$$

```
                      [Start Node]
                           |
                        (Level 1)
                           |
                        (Level 2)
                           |
                        (Level 3) -- (Dead End: Backtrack!)
```

#### 🛠️ Our Project Adaptation: Chronological Branch Visualization
Similar to BFS, our DFS traversal in [neo4j_service.py](file:///Users/archit/Documents/DAA_Book_Recommendation_System/backend/app/services/neo4j_service.py) is adapted to build a chronological visual thread:

1. **Reverse-Alphabetical Neighbor Insertion**:
   Because a stack pops from the top, neighbor nodes are sorted in **reverse alphabetical order** before being pushed onto the stack. This guarantees that alphabetical neighbors are processed first, aligning perfectly with our BFS algorithm's deterministic nature.
2. **"Rabbit Hole" Recommendation Threads**:
   While BFS is excellent for exploring a local cluster, DFS is utilized in our simulator to represent a **thematic journey**. It simulates a user starting at a book, diving deep into its author, jumping to a co-author, wandering into a sub-category, and emerging at an obscure book multiple degrees of separation away.

---

### 4. Graph-Driven Cypher Recommendation Scoring (Version 1)
#### 🔍 The Concept
This algorithm leverages high-speed index lookups in the graph database to find collaborative book recommendations. Instead of performing expensive relational table joins, it traverses the database structure along shared nodes.

```
  [Original Book] ──[:HAS_CATEGORY]──► [Category] ◄──[:HAS_CATEGORY]── [Recommended Book]
```

#### 🛠️ Mathematical Score Formulation
To calculate high-quality suggestions, the recommendation engine traverses all books sharing one or more categories with the searched book, filters out the original title to prevent duplicate results, and calculates a custom scoring matrix:

$$\text{Recommendation Score} = 5 \times (\text{Category Overlap}) + 3 \times (\text{Average Rating}) + 2 \times (\text{Popularity})$$

Where:
* **Category Overlap**: The quantity of category/genre nodes shared in common between the original book and the candidate book.
* **Average Rating**: The book's global rating, reflecting qualitative reader feedback.
* **Popularity**: Evaluated securely using the log scale of `ratings_count` to ensure massive bestsellers don't completely drown out lesser-known books with higher ratings.

#### 📝 Neo4j Cypher Implementation:
```cypher
MATCH (b:Book {title: $title})-[:HAS_CATEGORY]->(c:Category)<-[:HAS_CATEGORY]-(rec:Book)
WHERE b <> rec
WITH rec, collect(DISTINCT c.name) AS shared_categories
WITH rec, 
     size(shared_categories) AS category_overlap,
     coalesce(toFloat(rec.average_rating), 0.0) AS avg_rating,
     coalesce(toFloat(rec.ratings_count), 0.0) AS popularity
WITH rec, category_overlap, avg_rating, popularity,
     (5 * category_overlap + 3 * avg_rating + 2 * popularity) AS score
ORDER BY score DESC
LIMIT 10
OPTIONAL MATCH (rec)-[:WRITTEN_BY]->(a:Author)
RETURN rec.title AS title,
       rec.thumbnail AS thumbnail,
       rec.average_rating AS average_rating,
       collect(DISTINCT a.name) AS authors,
       score
```

---

### 5. Personalized Profile Hybrid Recommendation Engine
#### 🔍 The Concept
To provide users with recommendations that reflect their specific reading histories, we built a **Hybrid Personalization Algorithm** in [neo4j_service.py](file:///Users/archit/Documents/DAA_Book_Recommendation_System/backend/app/services/neo4j_service.py). This algorithm dynamically evaluates both user library actions and followed authors.

```
                       ┌───[:ADDED_TO_LIBRARY]───► [Book] ───[:HAS_CATEGORY]───► [Category]
                       │                                                              ▲
                    [User]                                                            │
                       │                                                        [:HAS_CATEGORY]
                       └───[:FOLLOWS]───► [Author] ◄───[:WRITTEN_BY]───────── [Candidate Book]
```

#### 🛠️ The Collaborative Weighted scoring
The algorithm matches paths from the user's specific Node ID (`uid`):
1. **Genre Match Pathway (Weight = 1.0)**:
   Traverses from the user node to all books in their library, maps their categories, and finds other books belonging to those categories:
   $$(User)-[:ADDED\_TO\_LIBRARY]\rightarrow(Book)-[:HAS\_CATEGORY]\rightarrow(Category)\leftarrow[:HAS\_CATEGORY]-(Candidate)$$
2. **Followed Author Pathway (Weight = 5.0)**:
   Directly pulls new books written by authors the user follows:
   $$(User)-[:FOLLOWS]\rightarrow(Author)\leftarrow[:WRITTEN\_BY]-(Candidate)$$

3. **Composite Scoring Aggregator**:
   The engine collects candidates from both paths, matches occurrences, sums up their weighted scores (`intersection_score`), and ranks them:
   $$\text{Score}(B) = \sum_{c \in \text{Paths}} \text{Weight}(c)$$
4. **Cold-Start Backfill Resolution**:
   If a user is new and has no books in their library or followed authors, the `intersection_score` will be 0. To resolve this, the algorithm falls back to a **Global Popularity Backfill** query, returning the highest-rated books in the database that are not already in the user's library.

---

### 6. Local Dynamic TTL Cache
#### 🔍 The Concept
Performing a full in-memory BMH approximate search requires access to all books, authors, and genres in the database. Performing a database scan across thousands of nodes for every keypress would cause severe latency spikes. We solved this by implementing an in-memory **Time-To-Live (TTL) Candidate Cache** in [neo4j_service.py](file:///Users/archit/Documents/DAA_Book_Recommendation_System/backend/app/services/neo4j_service.py).

* **TTL Duration**: 300 seconds (5 minutes).
* **Caching Mechanics**:
  * On a search request, the server checks if `_search_index` exists and if $\text{current\_time} - \text{last\_indexed} < \text{TTL}$.
  * If valid, it returns the cached lists instantly ($O(1)$ database latency).
  * If expired or empty, it executes three optimized, non-blocking Cypher queries in parallel, re-populates the cache, updates the timestamp, and continues.
  * When a user follows/unfollows an author or adds a book, the cache is explicitly invalidated (`invalidate_search_cache()`) to guarantee instant feedback.

---

### 7. Social Graph Analytics & Triadic Closure
#### 🔍 The Concept
A major component of GraphBooks is its native Social Network. Users can add books, leave 5-star ratings and reviews, and follow friends. Because Neo4j natively connects data points, calculating social proximity and overlapping libraries is executed directly at the database layer without complex SQL `JOIN` statements.

#### 🛠️ Our Project Adaptation: Social Features
1. **Triadic Closure for Friend Suggestions**:
   To suggest new friends to follow, the system uses the property of **Triadic Closure** (Friends of Friends). It queries the graph for users who are followed by your friends, but whom you do not yet follow, ranking them descending by the count of mutual friends.
   $$(You)-[:FOLLOWS]\rightarrow(Friend)-[:FOLLOWS]\rightarrow(Suggested\_Friend)$$

2. **Jaccard Similarity for Library Compatibility**:
   When comparing libraries with a friend, the system executes a **Jaccard Index** calculation: the size of the intersection divided by the size of the union of the two libraries.
   $$\text{Jaccard}(A, B) = \frac{|A \cap B|}{|A \cup B|}$$
   This algorithm yields a direct percentage "Compatibility Score" and isolates the symmetric difference to show shared books versus unique books.

3. **Social-Boosted Recommendations**:
   The recommendation engine factors in the `[:ADDED_TO_LIBRARY]` relationships of a user's friends. If a candidate book is present in a friend's library, it receives a $+2.0$ score multiplier, organically surfacing "word of mouth" recommendations based on network proximity.

---

## 📊 Dataset Ingestion & Wikipedia Enrichment Pipelines

GraphBooks does not rely on empty placeholders. It features a complete, high-fidelity data pipeline that generates and enriches its own corpus:

### 1. Procedural High-Fidelity Book Ingestion
The [generate_and_import.py](file:///Users/archit/Documents/DAA_Book_Recommendation_System/generate_and_import.py) script programmatically synthesizes a dataset of **3,550+ books** into the database:
* **Core Seeds**: Integrates complete, authentic biographies and catalogs for major authors (e.g., J.K. Rowling’s *Harry Potter* series, Rick Riordan's *Percy Jackson & The Olympians*, and Agatha Christie's Hercule Poirot & Miss Marple detective universes).
* **Procedural Synthesis**: Programmatically generates thousands of high-fidelity fictional books using extensive grammatical dictionaries for titles, descriptions, and tag-category structures.
* **Database Relationships**: Automatically maps nodes together using transaction batches of 200 nodes per query to ensure lightning-fast graph population.

### 2. Wikipedia Metadata Crawling
Using `wikipediaapi` in [enrich_database.py](file:///Users/archit/Documents/DAA_Book_Recommendation_System/enrich_database.py), the database pipeline executes automated web crawling to fetch real biographical details of authors and plot synopses of books, replacing placeholder text with genuine summaries.

### 3. Portrait Image Scraping & Runtime Resolution
In [enrich_images.py](file:///Users/archit/Documents/DAA_Book_Recommendation_System/enrich_images.py), the system queries the Wikipedia PageImages API to download authentic portrait images for authors. The backend supports **Dynamic File Extension Ingestion**:
* Real portraits are saved locally in the public folder as `safe_author_name.{png|jpg|jpeg|webp|avif|svg}`.
* When requesting details, the server performs a fast glob check (`glob.glob("public/authors/safe_author_name.*")`) and automatically resolves the correct file extension at runtime, preventing image broken states.

---

## 🛠️ Installation & Local Setup

### Prerequisites
* **Python**: Version 3.10 or higher
* **Node.js**: Version 18 or higher
* **Neo4j Database**: Neo4j Desktop or Community Server running a local database named `bookgraph`.

---

### Step 1: Start Neo4j
Ensure your local Neo4j instance is active and running. The database connection string defaults to `bolt://localhost:7687` with the username `neo4j`. Update the credentials in `backend/app/database.py` or `.env` if necessary.

---

### Step 2: Set Up the Backend (FastAPI)
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Activate your Python virtual environment:
   ```bash
   # On macOS/Linux:
   source ../venv/bin/env/activate
   # Or directly invoke python from the virtual environment:
   ../venv/bin/python -m pip install -r requirements.txt
   ```
3. Start the FastAPI development server:
   ```bash
   ../venv/bin/python -m uvicorn app.main:app --port 8000 --reload
   ```
   *The backend will boot up and run on [http://localhost:8000](http://localhost:8000).*

---

### Step 3: Set Up the Frontend (React + Vite)
1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The browser dashboard will launch, typically accessible on [http://localhost:5173](http://localhost:5173).*

---

### Step 4: Run Algorithmic Unit Tests
To verify that the custom Boyer-Moore-Horspool algorithm with dynamic mismatches and custom word-boundary heuristics is operating correctly, execute the test suite:
```bash
python backend/app/test_bmh.py
```

This runs five separate assertion phases covering text normalization, exact matching, $k$-mismatch approximate matching, scoring modifiers, and multi-entity searching.

---

## 🎨 Premium UI Design Systems
The GraphBooks client is designed with a premium, high-contrast **Glassmorphic Neo-Brutalist** theme:
* **Glassmorphism**: Elegant card borders, subtle shadows, and dark-themed backdrops provide depth and clarity.
* **3D Physics Simulations**: The simulation page features 3D physics-based force nodes. When you select BFS or DFS, nodes change color (e.g., Red for Books, Teal for Genres, Blue for Authors) and links thicken dynamically, turning the abstract complexity of graph algorithms into an engaging, visual spectacle.
