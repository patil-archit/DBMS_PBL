# BookLog

A social book diary and recommendation system. Log books with ratings and reviews, keep shelves and lists, follow other readers, get recommendations that explain themselves, and ask a chatbot for books in plain language.

**Stack:** PostgreSQL 15+ (main database) · Neo4j 5 (social graph) · MongoDB (logs, chat, cached recommendations) · FastAPI · React 19 + Vite + Tailwind · Firebase Auth · OpenAI (chatbot)

## Features

**Account**: Google sign-in, unique username, bio, language, private diary, favourite genres (asked on first sign-in), export all your data as JSON, delete your account and everything in it. Roles: reader, moderator, admin.

**Books & search**: search by title, author, genre or ISBN with spelling mistakes allowed (pg_trgm), filter by genre, language and minimum rating. Book pages show details, average rating, reviews, similar books and which people you follow have read it.

**Diary, shelves, lists**: log a book with date, half-star rating (0.5 to 5), review and a like; edit or delete entries; re-reads are separate entries. Want to Read and Reading Now shelves. Yearly reading goal with progress. Public or private ranked lists you can re-order. Like and comment on reviews and lists. Report reviews to moderators.

**Social**: follow / unfollow, followers and following, activity feed (what people you follow logged, rated, reviewed and listed), people you may know (friends of friends), taste match % and how many steps apart two readers are (Neo4j).

**Recommendations**: from your highly rated books, readers with similar taste (Neo4j), people you follow, authors you follow, your favourite genres and trending books (MongoDB). Every recommendation says why.

**Chatbot**: ask "a dark fantasy under 400 pages" or "something like Dune but shorter". The model can only see books through a `search_books` tool that queries PostgreSQL, and only books returned by the database are shown, so it can't invent titles. Conversations are saved in MongoDB.

**Admin & moderation**: add, edit and delete books, authors and genres (with parent genres); moderators handle reported reviews; reports on most read books, most active users and genre trends (materialized views); audit log of important changes; role management; sync status.

Not built (left out on purpose): predicted ratings and automatic theme/mood tagging (ML).

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

`seed_from_csv.py` drops and recreates everything, runs the migrations (including creating the `booklog_app` role) and loads the CSV catalogue. `import_openlibrary.py` adds ~2,100 more books with covers, author bios and photos. Both run as your own Postgres account.

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

End-to-end API test (54 checks, runs against a copy of the database):

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
  db/sync_neo4j.py              rebuild Neo4j from PostgreSQL
  db/migrate_from_neo4j.py      one-time import from the old Neo4j app
  db/demo_queries.sql           presentation demo
  app/main.py                   FastAPI app, health check
  app/deps.py                   Firebase sign-in, roles, per-request viewer
  app/database.py               PostgreSQL pool (sets app.user_id for RLS)
  app/graph.py                  Neo4j queries
  app/mongo.py                  MongoDB collections
  app/sync_worker.py            outbox worker
  app/services/                 book, diary, list, user, admin, chat logic
  app/routes/                   API routes
  tests/test_api.py             end-to-end test
frontend/src/
  pages/                        Home, Search, Book, Author, My Books, Lists, List,
                                Feed, People, Profile, Settings, Assistant, Admin
  components/                   shared UI, modals, review cards, goal widget...
  services/api.js               API client
```
