-- =====================================================================
-- BookLog: live database demo
-- Run:  psql -d booklog -f backend/db/demo_queries.sql
-- Or open psql -d booklog and paste one section at a time.
-- =====================================================================
\pset pager off
\echo '=== 1. Tables in the schema ==='
\dt

\echo '=== 2. Structure of BOOK (PK, FK to PUBLISHER, CHECK constraints) ==='
\d book

\echo '=== 3. Row counts ==='
SELECT 'book' AS tbl, count(*) FROM book
UNION ALL SELECT 'author', count(*) FROM author
UNION ALL SELECT 'genre', count(*) FROM genre
UNION ALL SELECT 'book_author', count(*) FROM book_author
UNION ALL SELECT 'book_genre', count(*) FROM book_genre;

\echo '=== 4. M:N join: books with their authors and genres ==='
SELECT b.title, a.name AS author, string_agg(g.name, ', ') AS genres
FROM book b
JOIN book_author ba ON ba.book_id = b.book_id
JOIN author a       ON a.author_id = ba.author_id
JOIN book_genre bg  ON bg.book_id = b.book_id
JOIN genre g        ON g.genre_id = bg.genre_id
GROUP BY b.book_id, a.name
ORDER BY b.avg_rating DESC
LIMIT 5;

\echo '=== 5. Aggregation: top authors by number of books and average rating ==='
SELECT a.name, count(*) AS books, round(avg(b.avg_rating), 2) AS avg_rating
FROM author a
JOIN book_author ba USING (author_id)
JOIN book b USING (book_id)
GROUP BY a.author_id
HAVING count(*) >= 5
ORDER BY books DESC
LIMIT 5;

\echo '=== 6. Spelling-tolerant search (pg_trgm): "hary pottr" ==='
SELECT title, round(word_similarity('hary pottr', lower(title))::numeric, 2) AS similarity
FROM book
WHERE word_similarity('hary pottr', lower(title)) > 0.45
ORDER BY similarity DESC
LIMIT 5;

\echo '=== 7. View: book_summary (one row per book, authors + genres as arrays) ==='
SELECT title, authors, genres FROM book_summary LIMIT 3;

\echo '=== 8. Demo data: two users, diary entries, friendship (inside a transaction, rolled back at the end) ==='
BEGIN;
INSERT INTO users (firebase_uid, friend_code, username) VALUES
    ('demo_a', 'demoA001', 'archit_demo'),
    ('demo_b', 'demoB001', 'bhavya_demo');

INSERT INTO diary_entry (user_id, book_id, rating, review_text, date_read)
SELECT u.user_id, b.book_id, 4.5, 'Loved it', CURRENT_DATE
FROM users u, book b
WHERE u.firebase_uid = 'demo_a' AND b.title IN ('The Murder on the Links', 'Poirot Investigates');

INSERT INTO diary_entry (user_id, book_id, rating, date_read)
SELECT u.user_id, b.book_id, 3.5, CURRENT_DATE
FROM users u, book b
WHERE u.firebase_uid = 'demo_b' AND b.title IN ('The Murder on the Links', 'Cards on the Table');

INSERT INTO user_follow (follower_id, followee_id)
SELECT a.user_id, b.user_id FROM users a, users b
WHERE (a.firebase_uid, b.firebase_uid) IN (('demo_a', 'demo_b'), ('demo_b', 'demo_a'));

\echo '--- Friend activity feed (what my friends logged) ---'
SELECT f.username AS friend, b.title, d.rating
FROM users me
JOIN user_follow uf ON uf.follower_id = me.user_id
JOIN users f        ON f.user_id = uf.followee_id
JOIN diary_entry d  ON d.user_id = f.user_id
JOIN book b         ON b.book_id = d.book_id
WHERE me.firebase_uid = 'demo_a';

\echo '--- Set operations: books both users read (INTERSECT) ---'
SELECT b.title FROM diary_entry d JOIN users u USING (user_id) JOIN book b USING (book_id) WHERE u.firebase_uid = 'demo_a'
INTERSECT
SELECT b.title FROM diary_entry d JOIN users u USING (user_id) JOIN book b USING (book_id) WHERE u.firebase_uid = 'demo_b';

\echo '=== 9. Integrity constraints (each of these is REJECTED by the database) ==='
SAVEPOINT s;
\echo '--- rating 4.3 (must be 0.5..5 in steps of 0.5) -> CHECK violation'
INSERT INTO diary_entry (user_id, book_id, rating)
SELECT user_id, 1, 4.3 FROM users WHERE firebase_uid = 'demo_a';
ROLLBACK TO s;
\echo '--- diary entry for a book that does not exist -> FOREIGN KEY violation'
INSERT INTO diary_entry (user_id, book_id, rating)
SELECT user_id, 999999, 4 FROM users WHERE firebase_uid = 'demo_a';
ROLLBACK TO s;
\echo '--- following the same friend twice -> PRIMARY KEY violation'
INSERT INTO user_follow (follower_id, followee_id)
SELECT a.user_id, b.user_id FROM users a, users b WHERE a.firebase_uid = 'demo_a' AND b.firebase_uid = 'demo_b';
ROLLBACK TO s;
\echo '--- following yourself -> CHECK violation'
INSERT INTO user_follow (follower_id, followee_id)
SELECT user_id, user_id FROM users WHERE firebase_uid = 'demo_a';
ROLLBACK TO s;

\echo '=== 10. TRIGGER: logging a rating updates the book average + count (row lock = no lost updates) ==='
SELECT title, avg_rating, ratings_count FROM book WHERE title = 'Cards on the Table';
INSERT INTO diary_entry (user_id, book_id, rating)
SELECT u.user_id, b.book_id, 1 FROM users u, book b WHERE u.firebase_uid = 'demo_a' AND b.title = 'Cards on the Table';
SELECT title, avg_rating, ratings_count FROM book WHERE title = 'Cards on the Table';

\echo '=== 11. TRIGGER: reading goal progress is maintained automatically ==='
INSERT INTO reading_goal (user_id, year, target_books)
SELECT user_id, EXTRACT(YEAR FROM CURRENT_DATE), 12 FROM users WHERE firebase_uid = 'demo_a';
SELECT u.username, g.year, g.target_books, g.books_finished
FROM reading_goal g JOIN users u USING (user_id) WHERE u.firebase_uid = 'demo_a';

\echo '=== 12. ROW-LEVEL SECURITY: Bhavya makes her diary private ==='
UPDATE users SET is_private = TRUE WHERE firebase_uid = 'demo_b';
-- the API connects as booklog_app (not a superuser) and says who is viewing
SET LOCAL ROLE booklog_app;
SELECT set_config('app.user_id', (SELECT user_id::text FROM users WHERE firebase_uid = 'demo_a'), true);
\echo '--- Archit looks at Bhavya''s diary: 0 rows (hidden by the policy) ---'
SELECT count(*) AS visible_entries FROM diary_entry d JOIN users u USING (user_id) WHERE u.firebase_uid = 'demo_b';
SELECT set_config('app.user_id', (SELECT user_id::text FROM users WHERE firebase_uid = 'demo_b'), true);
\echo '--- Bhavya looks at her own diary: she sees her entries ---'
SELECT count(*) AS visible_entries FROM diary_entry d JOIN users u USING (user_id) WHERE u.firebase_uid = 'demo_b';
RESET ROLE;
SELECT set_config('app.user_id', '', true);

\echo '=== 13. SYNC OUTBOX: changes queued for Neo4j / MongoDB in the same transaction ==='
SELECT id, target, op, payload FROM sync_outbox ORDER BY id DESC LIMIT 6;

\echo '=== 14. MATERIALIZED VIEW: most read books report ==='
REFRESH MATERIALIZED VIEW mv_most_read_books;
SELECT title, readers, times_logged, avg_user_rating FROM mv_most_read_books ORDER BY readers DESC LIMIT 5;

\echo '=== 15. ON DELETE CASCADE: deleting a user removes their diary, follows, goals... ==='
SELECT count(*) AS diary_rows_before FROM diary_entry;
DELETE FROM users WHERE firebase_uid = 'demo_a';
SELECT count(*) AS diary_rows_after FROM diary_entry;

ROLLBACK;
\echo '=== Demo data rolled back: database is unchanged ==='
