-- =====================================================================
-- BookLog phase 2 migration (runs after schema.sql)
--
--   * usernames become unique handles
--   * LIST gets an owner; COMMENT targets a review or a list
--   * likes, shelves, review reports
--   * triggers: book rating averages, reading-goal progress, audit log,
--     sync outbox for Neo4j / MongoDB
--   * row-level security on diary_entry (private diaries)
--   * materialized views for admin reports
--
-- Run:  psql -d booklog -f backend/db/migrations/002_phase2.sql
-- (seed_from_csv.py runs it automatically on a fresh database)
-- =====================================================================
BEGIN;

-- ---------------------------------------------------------------------
-- Session helpers: the API sets app.user_id / app.role at the start of
-- every transaction. Plain psql sessions leave them unset.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_user_id() RETURNS INT
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::INT $$;

CREATE OR REPLACE FUNCTION app_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.role', true), '') $$;

-- ---------------------------------------------------------------------
-- USERS: username is a unique handle (letters, digits, underscore)
-- ---------------------------------------------------------------------
UPDATE users
SET username = left(regexp_replace(lower(username), '[^a-z0-9_]+', '_', 'g'), 24) || '_' || user_id
WHERE username !~ '^[a-z0-9_]{3,30}$';

ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
ALTER TABLE users ADD CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9_]{3,30}$');
CREATE INDEX idx_users_username_trgm ON users USING GIN (username gin_trgm_ops);

-- ---------------------------------------------------------------------
-- LIST: owned by a user; books keep their rank (position)
-- ---------------------------------------------------------------------
ALTER TABLE list ADD COLUMN user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE;
ALTER TABLE list ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE INDEX idx_list_user ON list (user_id);

ALTER TABLE list_book ADD COLUMN added_at TIMESTAMPTZ NOT NULL DEFAULT now();
-- Deferred so a list can be re-ranked inside one transaction
ALTER TABLE list_book DROP CONSTRAINT list_book_list_id_position_key;
ALTER TABLE list_book ADD CONSTRAINT list_book_list_id_position_key
    UNIQUE (list_id, position) DEFERRABLE INITIALLY DEFERRED;

-- ---------------------------------------------------------------------
-- COMMENT: on exactly one review (diary entry) or one list
-- ---------------------------------------------------------------------
ALTER TABLE comment ADD COLUMN entry_id INT REFERENCES diary_entry(entry_id) ON DELETE CASCADE;
ALTER TABLE comment ADD COLUMN list_id  INT REFERENCES list(list_id) ON DELETE CASCADE;
ALTER TABLE comment ADD CONSTRAINT comment_one_target CHECK (num_nonnulls(entry_id, list_id) = 1);
ALTER TABLE comment ADD CONSTRAINT comment_text_length CHECK (length(comment_text) BETWEEN 1 AND 2000);
CREATE INDEX idx_comment_entry ON comment (entry_id);
CREATE INDEX idx_comment_list  ON comment (list_id);

-- ---------------------------------------------------------------------
-- Likes, shelves, reports
-- ---------------------------------------------------------------------
CREATE TABLE review_like (
    user_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    entry_id    INT NOT NULL REFERENCES diary_entry(entry_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, entry_id)
);
CREATE INDEX idx_review_like_entry ON review_like (entry_id);

CREATE TABLE list_like (
    user_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    list_id     INT NOT NULL REFERENCES list(list_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, list_id)
);
CREATE INDEX idx_list_like_list ON list_like (list_id);

CREATE TABLE shelf (
    user_id   INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    book_id   INT NOT NULL REFERENCES book(book_id) ON DELETE CASCADE,
    status    VARCHAR(20) NOT NULL CHECK (status IN ('want_to_read', 'currently_reading')),
    added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, book_id)
);

CREATE TABLE review_report (
    report_id    SERIAL PRIMARY KEY,
    entry_id     INT NOT NULL REFERENCES diary_entry(entry_id) ON DELETE CASCADE,
    reporter_id  INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason       VARCHAR(500) NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'removed')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_by  INT REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_at  TIMESTAMPTZ,
    UNIQUE (entry_id, reporter_id)
);
CREATE INDEX idx_review_report_open ON review_report (status, created_at);

CREATE INDEX idx_diary_user_date ON diary_entry (user_id, date_read);
CREATE INDEX idx_diary_created ON diary_entry (created_at DESC);

-- ---------------------------------------------------------------------
-- Trigger: keep book.avg_rating / ratings_count correct when users rate.
-- UPDATE on the book row takes a row lock, so concurrent ratings queue
-- up instead of overwriting each other (no lost updates).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_book_rating() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.rating IS NOT NULL THEN
        UPDATE book
        SET avg_rating = CASE WHEN ratings_count <= 1 THEN 0
                              ELSE LEAST(5, GREATEST(0, (avg_rating * ratings_count - OLD.rating) / (ratings_count - 1))) END,
            ratings_count = GREATEST(ratings_count - 1, 0)
        WHERE book_id = OLD.book_id;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.rating IS NOT NULL THEN
        UPDATE book
        SET avg_rating = LEAST(5, (avg_rating * ratings_count + NEW.rating) / (ratings_count + 1)),
            ratings_count = ratings_count + 1
        WHERE book_id = NEW.book_id;
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER diary_entry_rating
AFTER INSERT OR DELETE OR UPDATE OF rating, book_id ON diary_entry
FOR EACH ROW EXECUTE FUNCTION trg_book_rating();

-- ---------------------------------------------------------------------
-- Trigger: reading_goal.books_finished = distinct books logged that year
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION books_finished_in(p_user INT, p_year INT) RETURNS INT
LANGUAGE sql STABLE AS $$
    SELECT count(DISTINCT book_id)::INT FROM diary_entry
    WHERE user_id = p_user AND date_read IS NOT NULL
      AND EXTRACT(YEAR FROM date_read) = p_year
$$;

CREATE OR REPLACE FUNCTION trg_goal_from_diary() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.date_read IS NOT NULL THEN
        UPDATE reading_goal SET books_finished = books_finished_in(OLD.user_id, year)
        WHERE user_id = OLD.user_id AND year = EXTRACT(YEAR FROM OLD.date_read);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.date_read IS NOT NULL THEN
        UPDATE reading_goal SET books_finished = books_finished_in(NEW.user_id, year)
        WHERE user_id = NEW.user_id AND year = EXTRACT(YEAR FROM NEW.date_read);
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER diary_entry_goal
AFTER INSERT OR DELETE OR UPDATE OF date_read, book_id ON diary_entry
FOR EACH ROW EXECUTE FUNCTION trg_goal_from_diary();

CREATE OR REPLACE FUNCTION trg_goal_init() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    NEW.books_finished := books_finished_in(NEW.user_id, NEW.year);
    RETURN NEW;
END $$;

CREATE TRIGGER reading_goal_init
BEFORE INSERT OR UPDATE OF target_books, year ON reading_goal
FOR EACH ROW EXECUTE FUNCTION trg_goal_init();

-- ---------------------------------------------------------------------
-- Audit log for important changes
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
    audit_id    BIGSERIAL PRIMARY KEY,
    table_name  TEXT NOT NULL,
    operation   TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    changed_by  INT,                       -- app.user_id of whoever made the change (NULL = script)
    old_data    JSONB,
    new_data    JSONB,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_changed_at ON audit_log (changed_at DESC);

CREATE OR REPLACE FUNCTION trg_audit() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    -- skip bulk loads from scripts (no app user) to keep the log readable
    IF app_user_id() IS NULL THEN
        RETURN NULL;
    END IF;
    INSERT INTO audit_log (table_name, operation, changed_by, old_data, new_data)
    VALUES (TG_TABLE_NAME, TG_OP, app_user_id(),
            CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
            CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
    RETURN NULL;
END $$;

CREATE TRIGGER audit_book      AFTER INSERT OR UPDATE OR DELETE ON book      FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit_author    AFTER INSERT OR UPDATE OR DELETE ON author    FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit_genre     AFTER INSERT OR UPDATE OR DELETE ON genre     FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit_publisher AFTER INSERT OR UPDATE OR DELETE ON publisher FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit_report    AFTER UPDATE ON review_report FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit_users_role AFTER UPDATE OF role ON users FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit_users_delete AFTER DELETE ON users FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit_diary_delete AFTER DELETE ON diary_entry FOR EACH ROW EXECUTE FUNCTION trg_audit();

-- book.avg_rating changes on every rating; don't audit those
DROP TRIGGER audit_book ON book;
CREATE TRIGGER audit_book AFTER INSERT OR DELETE ON book FOR EACH ROW EXECUTE FUNCTION trg_audit();
CREATE TRIGGER audit_book_update AFTER UPDATE ON book FOR EACH ROW
    WHEN ((to_jsonb(OLD) - 'avg_rating' - 'ratings_count') IS DISTINCT FROM (to_jsonb(NEW) - 'avg_rating' - 'ratings_count'))
    EXECUTE FUNCTION trg_audit();

-- ---------------------------------------------------------------------
-- Sync outbox: changes that must reach Neo4j / MongoDB are queued in the
-- SAME transaction as the PostgreSQL change, then a worker applies them
-- and retries failures until everything matches.
-- ---------------------------------------------------------------------
CREATE TABLE sync_outbox (
    id          BIGSERIAL PRIMARY KEY,
    target      TEXT NOT NULL CHECK (target IN ('neo4j', 'mongo')),
    op          TEXT NOT NULL,
    payload     JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts    INT NOT NULL DEFAULT 0,
    last_error  TEXT,
    done_at     TIMESTAMPTZ
);
CREATE INDEX idx_sync_outbox_pending ON sync_outbox (id) WHERE done_at IS NULL;

CREATE OR REPLACE FUNCTION trg_outbox_users() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO sync_outbox (target, op, payload) VALUES
            ('neo4j', 'delete_user', jsonb_build_object('user_id', OLD.user_id)),
            ('mongo', 'delete_user', jsonb_build_object('user_id', OLD.user_id));
    ELSE
        INSERT INTO sync_outbox (target, op, payload)
        VALUES ('neo4j', 'upsert_user', jsonb_build_object('user_id', NEW.user_id, 'username', NEW.username));
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER outbox_users AFTER INSERT OR DELETE OR UPDATE OF username ON users
FOR EACH ROW EXECUTE FUNCTION trg_outbox_users();

CREATE OR REPLACE FUNCTION trg_outbox_follow() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO sync_outbox (target, op, payload)
    VALUES ('neo4j', CASE TG_OP WHEN 'INSERT' THEN 'follow' ELSE 'unfollow' END,
            CASE TG_OP WHEN 'INSERT'
                THEN jsonb_build_object('follower_id', NEW.follower_id, 'followee_id', NEW.followee_id)
                ELSE jsonb_build_object('follower_id', OLD.follower_id, 'followee_id', OLD.followee_id) END);
    RETURN NULL;
END $$;

CREATE TRIGGER outbox_follow AFTER INSERT OR DELETE ON user_follow
FOR EACH ROW EXECUTE FUNCTION trg_outbox_follow();

-- A user "read" a book: one RATED edge per (user, book) holding the latest rating
CREATE OR REPLACE FUNCTION trg_outbox_diary() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        INSERT INTO sync_outbox (target, op, payload)
        VALUES ('neo4j', 'refresh_read', jsonb_build_object('user_id', OLD.user_id, 'book_id', OLD.book_id));
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        INSERT INTO sync_outbox (target, op, payload)
        VALUES ('neo4j', 'refresh_read', jsonb_build_object('user_id', NEW.user_id, 'book_id', NEW.book_id));
    END IF;
    RETURN NULL;
END $$;

CREATE TRIGGER outbox_diary AFTER INSERT OR DELETE OR UPDATE OF rating, book_id, is_liked ON diary_entry
FOR EACH ROW EXECUTE FUNCTION trg_outbox_diary();

-- ---------------------------------------------------------------------
-- Row-level security: private diaries are only visible to their owner
-- (and moderators/admins). FORCE applies it to the table owner too,
-- which is the role the API connects as.
-- ---------------------------------------------------------------------
ALTER TABLE diary_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE diary_entry FORCE ROW LEVEL SECURITY;

CREATE POLICY diary_select ON diary_entry FOR SELECT USING (
    app_user_id() IS NULL                                     -- maintenance scripts / psql
    OR user_id = app_user_id()                                -- your own diary
    OR app_role() IN ('moderator', 'admin')
    OR NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = diary_entry.user_id AND u.is_private)
);
CREATE POLICY diary_insert ON diary_entry FOR INSERT WITH CHECK (
    app_user_id() IS NULL OR user_id = app_user_id()
);
CREATE POLICY diary_update ON diary_entry FOR UPDATE USING (
    app_user_id() IS NULL OR user_id = app_user_id()
);
CREATE POLICY diary_delete ON diary_entry FOR DELETE USING (
    app_user_id() IS NULL OR user_id = app_user_id() OR app_role() IN ('moderator', 'admin')
);

-- ---------------------------------------------------------------------
-- Materialized views for admin reports (REFRESH from the admin page)
-- ---------------------------------------------------------------------
CREATE MATERIALIZED VIEW mv_most_read_books AS
SELECT b.book_id, b.title,
       count(d.entry_id)                AS times_logged,
       count(DISTINCT d.user_id)        AS readers,
       round(avg(d.rating), 2)          AS avg_user_rating,
       count(*) FILTER (WHERE d.is_liked) AS likes
FROM book b
JOIN diary_entry d ON d.book_id = b.book_id
GROUP BY b.book_id;
CREATE UNIQUE INDEX ON mv_most_read_books (book_id);

CREATE MATERIALIZED VIEW mv_active_users AS
SELECT u.user_id, u.username,
       (SELECT count(*) FROM diary_entry d WHERE d.user_id = u.user_id) AS entries,
       (SELECT count(*) FROM diary_entry d WHERE d.user_id = u.user_id AND d.review_text IS NOT NULL) AS reviews,
       (SELECT count(*) FROM comment c WHERE c.user_id = u.user_id) AS comments,
       (SELECT count(*) FROM list l WHERE l.user_id = u.user_id) AS lists
FROM users u;
CREATE UNIQUE INDEX ON mv_active_users (user_id);

CREATE MATERIALIZED VIEW mv_genre_trends AS
SELECT g.genre_id, g.name AS genre,
       date_trunc('month', COALESCE(d.date_read, d.created_at::date))::date AS month,
       count(*) AS logs,
       round(avg(d.rating), 2) AS avg_rating
FROM diary_entry d
JOIN book_genre bg ON bg.book_id = d.book_id
JOIN genre g ON g.genre_id = bg.genre_id
GROUP BY g.genre_id, month;
CREATE UNIQUE INDEX ON mv_genre_trends (genre_id, month);

-- book_summary also exposes book_id-friendly extras
CREATE OR REPLACE VIEW book_summary AS
SELECT b.book_id,
       b.title,
       b.isbn,
       b.subtitle,
       b.cover_url,
       b.avg_rating,
       b.ratings_count,
       b.description,
       COALESCE(ARRAY(SELECT a.name FROM book_author ba JOIN author a USING (author_id)
                      WHERE ba.book_id = b.book_id ORDER BY a.name), '{}') AS authors,
       COALESCE(ARRAY(SELECT g.name FROM book_genre bg JOIN genre g USING (genre_id)
                      WHERE bg.book_id = b.book_id ORDER BY g.name), '{}') AS genres,
       b.language,
       b.page_count,
       b.pub_year
FROM book b;

COMMIT;
