# BookLog

A social book diary and recommendation system. Log books with ratings and reviews, keep shelves and lists, follow other readers, get recommendations that explain themselves, and ask a chatbot for books in plain language.

*DBMS course project (CD252IA), Department of ISE, RV College of Engineering, by Archit Patil and Bhavya Chawat.*

**Stack:** PostgreSQL 15+ (main database) · Neo4j 5 (social graph) · MongoDB (logs, chat, cached recommendations) · FastAPI · React 19 + Vite + Tailwind · Framer Motion + Lenis · Firebase Auth · OpenAI (chatbot)

## Features

**Account**: Google sign-in, unique username, bio, language, private diary, favourite genres (asked on first sign-in), export all your data as JSON, delete your account and everything in it. Roles: reader, moderator, admin.

**Books & search**: a catalogue of 20,000+ books with covers, descriptions, authors (bios and photos) and publishers. Live search as you type by title, author, genre or ISBN with spelling mistakes allowed (pg_trgm), filter by genre, language and minimum rating; the page shows how many milliseconds PostgreSQL took. A **⌘K / Ctrl+K command palette** searches from anywhere. Book pages show details, reading time, average rating, reviews, similar books (with the scoring explained) and which people you follow have read it, shown as a 3D book with the cover's colour palette.

**Explore**: browse the whole catalogue with infinite scroll, filtered by genre, decade, length and rating and sorted by most read, highest rated, newest, oldest, shortest or longest. "Spin the shelf" picks a random well-rated book. The home page has a book of the day, the catalogue in numbers (books per decade of publication) and a genre index.

**Flips**: flip through books one screen at a time (For you, Latest, Following). Readers leave short "takes" on a book (a fun fact, a hot take, a mood) that everyone can see with the reader's name, and anyone signed in can like them. Takes live in MongoDB; the one exception comes from PostgreSQL: a private account's takes are shown only to its followers (`users.is_private` + `user_follow`).

**Diary, shelves, lists**: log a book with date, half-star rating (0.5 to 5), review and a like; edit or delete entries; re-reads are separate entries. Want to Read and Reading Now shelves. Yearly reading goal with progress. Public or private ranked lists you can re-order. Like and comment on reviews and lists. Report reviews to moderators.

**Social**: follow / unfollow, followers and following, activity feed (what people you follow logged, rated, reviewed and listed), people you may know (friends of friends), taste match % and how many steps apart two readers are (Neo4j).

**Year in books**: every reader gets a stats page (`/u/<username>/stats`, by year or all time): books, pages, reviews, re-reads, books per month, rating spread, favourite genres and authors, how their ratings compare with everyone else's, and highlights (top rated, longest, shortest, oldest, hidden gem). It reads the diary under row-level security, so private diaries stay private.

**Recommendations**: from your highly rated books, readers with similar taste (Neo4j), people you follow, authors you follow, your favourite genres and trending books (MongoDB). Every recommendation says why.

**Chatbot**: ask "a dark fantasy under 400 pages" or "something like Dune but shorter". The model can only see books through a `search_books` tool that queries PostgreSQL, and only books returned by the database are shown, so it can't invent titles. Conversations are saved in MongoDB.

**Admin & moderation**: add, edit and delete books, authors and genres (with parent genres); moderators handle reported reviews; reports on most read books, most active users and genre trends (materialized views); audit log of important changes; role management; sync status.

Not built (left out on purpose): predicted ratings and automatic theme/mood tagging (ML).

## Design

"Dog-eared": cream paper, one tomato red for type, tall condensed caps (Bayon) for anything loud and small uppercase grotesk (Inter Tight) for everything else, with pink and sky-blue sections. Light mode and a night-reading mode.

The cast is a set of original line-drawn **book-dogs** (`frontend/src/components/Dogs.jsx`). Each is a book that became a dog: its floppy ears are the hardcover boards, its shaggy coat is the page edges and its leash is the red ribbon bookmark. Each one has an accessory (glasses, beret, quill, headphones, crown, bow), and every feature gets its own dog. They blink, their eyes follow the cursor, their ears swing and the ribbon sways. The logo is a book-dachshund that trots across the loading screen.

Motion and 3D: real CSS 3D books (cover, spine with the title, page block) that turn toward the pointer, words that rise from behind masks as you scroll, floating page-balls, parallax, a ribbon that draws itself down the page, and a red flood when you enter from the cover page. Everything respects `prefers-reduced-motion`.

The home page tells the whole project top to bottom: hero, about (with live counts), "our shelves" (every feature, each with its dog), how it works, your circle (signed in), today's pick as a 3D book, authors with bios, "pick your pace" (yearly reading goal), the assistant, and readers.

## How the three databases work together

| Database | Holds | Why |
|---|---|---|
| **PostgreSQL** (source of truth) | Catalogue, users, diary, lists, comments, likes, shelves, goals, reports, audit log | ACID transactions, constraints, triggers, row-level security |
| **Neo4j** | `(:User)-[:FOLLOWS]->(:User)`, `(:User)-[:RATED]->(:Book)` | Friends of friends, shortest path, taste similarity |
| **MongoDB** | `activity_logs`, `chat_sessions`, `saved_recommendations` (TTL index, 1 hour) | Flexible documents, high-volume logs, automatic expiry |

**Keeping them consistent.** PostgreSQL triggers write every follow, diary change and account deletion into a `sync_outbox` table *in the same transaction* as the change. A background worker in the API applies the outbox to Neo4j / MongoDB and retries failures until they succeed (pending rows and errors show on the admin page). `backend/db/sync_neo4j.py` rebuilds the graph from PostgreSQL. If Neo4j or MongoDB is down, the app keeps working: social features fall back to SQL and logging is skipped.

## PostgreSQL design highlights

- Schema follows the ER diagram ([schema.sql](backend/db/schema.sql)) plus [migrations](backend/db/migrations/).
- **Triggers**: book average rating and rating count update on every diary change (the row lock prevents lost updates under concurrency); reading-goal progress; audit log; sync outbox.
- **Row-level security** on `diary_entry`: private diaries are invisible to other users at the database level. The API connects as `booklog_app` (not a superuser, because superusers bypass RLS) and sets `app.user_id` for each transaction.
- **Constraints**: rating 0.5–5 in steps of 0.5, no self-follow, unique follows / likes, a comment targets exactly one review or list, list positions unique (deferred so lists can be re-ranked in one transaction), username format.
- **Materialized views** for admin reports; **GIN trigram indexes** for search.
- **Cascading deletes**: deleting an account removes everything belonging to it in one transaction.

Differences from the ER diagram (all needed by features): `users` instead of the reserved word `USER`; `users.firebase_uid` / `friend_code`; `book.subtitle` / `cover_url` / `ratings_count`; `author.photo_url`; `list.user_id` (owner); `comment.entry_id` / `list_id` (what is commented on); extra tables `user_follow`, `author_follow`, `review_like`, `list_like`, `shelf`, `review_report`, `audit_log`, `sync_outbox`.

## Setup

### 1. Databases

PostgreSQL (`brew install postgresql@15`), Neo4j (`brew install neo4j`) and MongoDB:

```bash
brew trust mongodb/brew && brew install mongodb-community
```

```bash
brew services start postgresql@15 && brew services start neo4j && brew services start mongodb-community
```

Set a Neo4j password before its first start: `neo4j-admin dbms set-initial-password <password>`.

### 2. Load the data

```bash
createdb booklog
```

```bash
backend/venv/bin/python backend/db/seed_from_csv.py
```

```bash
backend/venv/bin/python backend/db/import_openlibrary.py
```

```bash
backend/venv/bin/python backend/db/backfill_openlibrary.py
```

`seed_from_csv.py` drops and recreates everything, runs the migrations (including creating the `booklog_app` role) and loads the CSV catalogue. `import_openlibrary.py` adds books from Open Library across ~100 subjects with covers, descriptions, author bios and photos (`--per-genre 300 --pages 6 --workers 8` gives 20,000+; API responses are cached, so re-runs are fast). `backfill_openlibrary.py` finishes an import that was stopped early: it fills in real descriptions and author bios and photos that were skipped, and can be stopped and re-run at any time. With `--wikipedia` it falls back to the Wikipedia page summary for authors Open Library has nothing on, accepting it only when the page describes a writer (Wikipedia text is CC BY-SA 4.0). All three run as your own Postgres account.

### 3. Backend

Copy `backend/.env.example` to `backend/.env` and fill in `NEO4J_PASSWORD` and `OPENAI_API_KEY` (for the chatbot). Never commit `.env`.

```bash
cd backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt
```

```bash
cd backend && venv/bin/uvicorn app.main:app --reload --port 8000
```

The Firebase Admin service account JSON must be in the repo root. API docs: http://localhost:8000/docs · Health of all three databases: http://localhost:8000/health

**Make yourself an admin** (after signing in once):

```bash
psql -d booklog -c "UPDATE users SET role = 'admin' WHERE username = 'your_username'"
```

### 4. Frontend

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173

## Backup, restore and sharing

```bash
sh backend/db/backup.sh
```

creates `backups/booklog-<date>.dump` (about 1 MB, ignored by git). On another computer, after installing PostgreSQL:

```bash
sh backend/db/restore.sh booklog-2026-11-11.dump
```

This creates the `booklog` database, restores all tables, data, triggers, row-level security policies and views, re-creates the `booklog_app` / `booklog_reports` roles, and rebuilds Neo4j from PostgreSQL. MongoDB lives in Atlas, so everyone using the same `MONGO_URL` shares it.

Files that are **not** in git and must be sent privately: `backend/.env` (each person sets their own `NEO4J_PASSWORD`) and the Firebase service account JSON in the repo root.

## Tests and demo

End-to-end API test (94 checks, runs against a copy of the database):

```bash
dropdb --if-exists booklog_test && createdb booklog_test && pg_dump booklog | psql -q booklog_test
```

```bash
DATABASE_URL=postgresql://booklog_app@localhost:5432/booklog_test backend/venv/bin/python backend/tests/test_api.py
```

Live database demo for presentations (joins, aggregation, fuzzy search, constraints, triggers, row-level security, outbox, materialized views, cascades; rolls everything back):

```bash
psql -d booklog -f backend/db/demo_queries.sql
```

## Project layout

```
backend/
  db/schema.sql                 base schema (ER diagram)
  db/migrations/                002 phase 2 (tables, triggers, RLS, views), 003 app role
  db/seed_from_csv.py           reset + load CSV catalogue
  db/import_openlibrary.py      add books from Open Library
  db/backfill_openlibrary.py    fill in skipped descriptions, author bios and photos
  db/sync_neo4j.py              rebuild Neo4j from PostgreSQL
  db/migrate_from_neo4j.py      one-time import from the old Neo4j app
  db/demo_queries.sql           presentation demo
  app/main.py                   FastAPI app, health check
  app/deps.py                   Firebase sign-in, roles, per-request viewer
  app/database.py               PostgreSQL pool (sets app.user_id for RLS)
  app/graph.py                  Neo4j queries
  app/mongo.py                  MongoDB collections
  app/sync_worker.py            outbox worker
  app/services/                 book, discover, diary, list, user, admin, chat logic
  app/routes/                   API routes
  tests/test_api.py             end-to-end test
frontend/src/
  pages/                        Home, Explore, Search, Book, Author, My Books, Lists, List,
                                Feed, People, Profile, Year in books, Settings, Assistant, Admin
  components/shell.jsx          intro, smooth scroll, cursor, page transitions, ⌘K palette, theme
  components/Logo.jsx           the BookLog mark and wordmark
  components/                   shared UI, modals, review cards, goal widget...
  utils/colors.js               colour palette extraction from covers
  services/api.js               API client
```
