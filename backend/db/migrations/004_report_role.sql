-- =====================================================================
-- Report views owner.
--
-- A materialized view is refreshed with the privileges of its owner. If the
-- owner is booklog_app (subject to FORCE ROW LEVEL SECURITY on diary_entry),
-- restoring a pg_dump backup fails ("query would be affected by row-level
-- security") and the admin reports come back empty.
--
-- booklog_reports is a NOLOGIN role with BYPASSRLS that only owns the report
-- views and can only SELECT the tables they read. booklog_app is a member so
-- it may REFRESH them; BYPASSRLS is not inherited, so the app itself still
-- cannot read private diaries.
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'booklog_reports') THEN
        CREATE ROLE booklog_reports NOLOGIN BYPASSRLS;
    END IF;
END $$;

GRANT USAGE ON SCHEMA public TO booklog_reports;
GRANT SELECT ON book, diary_entry, users, comment, list, genre, book_genre TO booklog_reports;
GRANT booklog_reports TO booklog_app;

ALTER MATERIALIZED VIEW mv_most_read_books OWNER TO booklog_reports;
ALTER MATERIALIZED VIEW mv_active_users    OWNER TO booklog_reports;
ALTER MATERIALIZED VIEW mv_genre_trends    OWNER TO booklog_reports;
GRANT SELECT ON mv_most_read_books, mv_active_users, mv_genre_trends TO booklog_app;

REFRESH MATERIALIZED VIEW mv_most_read_books;
REFRESH MATERIALIZED VIEW mv_active_users;
REFRESH MATERIALIZED VIEW mv_genre_trends;
