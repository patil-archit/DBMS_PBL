# BookLog database snapshot

| File | What it is | Use it for |
|---|---|---|
| `booklog.dump` | PostgreSQL custom-format backup (compressed) | Restoring the database |
| `booklog.sql` | The same backup as plain SQL | Reading the schema, triggers, policies and data |

Both contain the full schema (tables, constraints, triggers, row-level security
policies, views, materialized views) and all data: 2,446 books, 1,727 authors,
1,351 publishers, 54 genres, plus the demo users' diaries and follows.
**User email addresses were removed** because this repository is public.

## Restore

From the repo root, with PostgreSQL running:

```bash
sh backend/db/restore.sh database/booklog.dump
```

This creates the `booklog` database, restores everything, re-creates the
`booklog_app` / `booklog_reports` roles (a dump can't carry roles), and rebuilds
the Neo4j graph from PostgreSQL if Neo4j is running.

To make a fresh snapshot: `sh backend/db/backup.sh` (writes to `backups/`, not tracked).
