-- =====================================================================
-- Application role.
--
-- PostgreSQL superusers always bypass row-level security, so the API must
-- NOT connect as one. `booklog_app` is an ordinary login role that owns the
-- application tables (and is therefore also subject to FORCE ROW LEVEL
-- SECURITY on diary_entry). The API connects with:
--     DATABASE_URL=postgresql://booklog_app@localhost:5432/booklog
-- Setup scripts (seed / migrations) still run as your own superuser account.
-- =====================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'booklog_app') THEN
        CREATE ROLE booklog_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
    END IF;
END $$;

GRANT USAGE, CREATE ON SCHEMA public TO booklog_app;

DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO booklog_app', r.name);
    END LOOP;
    FOR r IN SELECT sequencename AS name FROM pg_sequences WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO booklog_app', r.name);
    END LOOP;
    FOR r IN SELECT viewname AS name FROM pg_views WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER VIEW public.%I OWNER TO booklog_app', r.name);
    END LOOP;
    FOR r IN SELECT matviewname AS name FROM pg_matviews WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER MATERIALIZED VIEW public.%I OWNER TO booklog_app', r.name);
    END LOOP;
END $$;
