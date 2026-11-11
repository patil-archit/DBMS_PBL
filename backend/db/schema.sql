-- =====================================================================
-- BookLog: PostgreSQL schema (Book Diary Database)
--
-- Follows the ER diagram / relational schema:
--   PUBLISHER, BOOK, AUTHOR, BOOK_AUTHOR, GENRE, BOOK_GENRE, TAG, BOOK_TAG,
--   USER (users), DIARY_ENTRY, COMMENT, READING_GOAL, USER_GENRE, LIST, LIST_BOOK
--
-- Notes on small deviations, all needed by features the app already has:
--   * USER is a reserved word in PostgreSQL, so the table is named "users".
--   * users.firebase_uid / users.friend_code: sign-in is done with Firebase and
--     friends are added by a short friend code.
--   * book.subtitle / book.cover_url / book.ratings_count: shown on book cards
--     and used for ranking recommendations.
--   * author.photo_url: author photo shown on author pages.
--   * user_follow and author_follow back the existing "follow a friend" and
--     "follow an author" features (not drawn in the ER diagram yet).
--
-- Tables for v2 features (LIST, LIST_BOOK, COMMENT, TAG, BOOK_TAG,
-- READING_GOAL, USER_GENRE) are created here so the schema matches the ER
-- diagram, but the application does not use them yet.
--
-- Run:  psql -d booklog -f backend/db/schema.sql
-- =====================================================================

-- Full reset: drop everything (tables, views, functions, policies)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- spelling-tolerant search

-- ---------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------
CREATE TABLE publisher (
    publisher_id  SERIAL PRIMARY KEY,
    name          VARCHAR(200) NOT NULL UNIQUE,
    country       VARCHAR(100)
);

CREATE TABLE book (
    book_id       SERIAL PRIMARY KEY,
    publisher_id  INT REFERENCES publisher(publisher_id) ON DELETE SET NULL,
    title         VARCHAR(500) NOT NULL UNIQUE,
    subtitle      VARCHAR(500),
    isbn          VARCHAR(13) UNIQUE,
    language      VARCHAR(10) NOT NULL DEFAULT 'en',
    description   TEXT,
    pub_year      SMALLINT CHECK (pub_year BETWEEN 0 AND 2100),
    page_count    INT CHECK (page_count > 0),
    avg_rating    NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (avg_rating BETWEEN 0 AND 5),
    ratings_count INT NOT NULL DEFAULT 0 CHECK (ratings_count >= 0),
    cover_url     TEXT
);

CREATE TABLE author (
    author_id  SERIAL PRIMARY KEY,
    name       VARCHAR(200) NOT NULL UNIQUE,
    bio        TEXT,
    photo_url  TEXT
);

CREATE TABLE book_author (
    author_id  INT NOT NULL REFERENCES author(author_id) ON DELETE CASCADE,
    book_id    INT NOT NULL REFERENCES book(book_id) ON DELETE CASCADE,
    PRIMARY KEY (author_id, book_id)
);

CREATE TABLE genre (
    genre_id         SERIAL PRIMARY KEY,
    name             VARCHAR(100) NOT NULL UNIQUE,
    parent_genre_id  INT REFERENCES genre(genre_id) ON DELETE SET NULL,
    CHECK (parent_genre_id IS NULL OR parent_genre_id <> genre_id)
);

CREATE TABLE book_genre (
    genre_id  INT NOT NULL REFERENCES genre(genre_id) ON DELETE CASCADE,
    book_id   INT NOT NULL REFERENCES book(book_id) ON DELETE CASCADE,
    PRIMARY KEY (genre_id, book_id)
);

CREATE TABLE tag (
    tag_id    SERIAL PRIMARY KEY,
    name      VARCHAR(100) NOT NULL,
    tag_type  VARCHAR(30) NOT NULL DEFAULT 'theme' CHECK (tag_type IN ('theme', 'mood')),
    UNIQUE (name, tag_type)
);

CREATE TABLE book_tag (
    tag_id   INT NOT NULL REFERENCES tag(tag_id) ON DELETE CASCADE,
    book_id  INT NOT NULL REFERENCES book(book_id) ON DELETE CASCADE,
    PRIMARY KEY (tag_id, book_id)
);

-- ---------------------------------------------------------------------
-- Users and diary
-- ---------------------------------------------------------------------
CREATE TABLE users (
    user_id        SERIAL PRIMARY KEY,
    firebase_uid   VARCHAR(128) NOT NULL UNIQUE,
    friend_code    VARCHAR(16)  NOT NULL UNIQUE,
    username       VARCHAR(100) NOT NULL,
    email          VARCHAR(255) UNIQUE,
    password_hash  TEXT,                       -- NULL while Firebase handles sign-in
    role           VARCHAR(20) NOT NULL DEFAULT 'reader'
                   CHECK (role IN ('reader', 'moderator', 'admin')),
    bio            TEXT,
    language       VARCHAR(10) NOT NULL DEFAULT 'en',
    is_private     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A user's library is the set of books they have logged in their diary.
CREATE TABLE diary_entry (
    entry_id     SERIAL PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    book_id      INT NOT NULL REFERENCES book(book_id) ON DELETE CASCADE,
    rating       NUMERIC(2,1) CHECK (rating BETWEEN 0.5 AND 5 AND rating * 2 = FLOOR(rating * 2)),
    review_text  TEXT,
    date_read    DATE,
    is_liked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_follow (
    follower_id  INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    followee_id  INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);

CREATE TABLE author_follow (
    user_id     INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    author_id   INT NOT NULL REFERENCES author(author_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, author_id)
);

-- ---------------------------------------------------------------------
-- v2 tables (schema only, not used by the app yet)
-- ---------------------------------------------------------------------
CREATE TABLE user_genre (
    user_id   INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    genre_id  INT NOT NULL REFERENCES genre(genre_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, genre_id)
);

CREATE TABLE reading_goal (
    user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    year            SMALLINT NOT NULL,
    target_books    INT NOT NULL CHECK (target_books > 0),
    books_finished  INT NOT NULL DEFAULT 0 CHECK (books_finished >= 0),
    PRIMARY KEY (user_id, year)
);

CREATE TABLE comment (
    comment_id    SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    comment_text  TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE list (
    list_id      SERIAL PRIMARY KEY,
    name         VARCHAR(200) NOT NULL,
    description  TEXT,
    is_public    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE list_book (
    list_id   INT NOT NULL REFERENCES list(list_id) ON DELETE CASCADE,
    book_id   INT NOT NULL REFERENCES book(book_id) ON DELETE CASCADE,
    position  INT NOT NULL CHECK (position > 0),
    PRIMARY KEY (list_id, book_id),
    UNIQUE (list_id, position)
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
CREATE INDEX idx_book_title_trgm   ON book   USING GIN (lower(title) gin_trgm_ops);
CREATE INDEX idx_author_name_trgm  ON author USING GIN (lower(name)  gin_trgm_ops);
CREATE INDEX idx_genre_name_trgm   ON genre  USING GIN (lower(name)  gin_trgm_ops);
CREATE INDEX idx_book_author_book  ON book_author (book_id);
CREATE INDEX idx_book_genre_book   ON book_genre (book_id);
CREATE INDEX idx_diary_user        ON diary_entry (user_id, created_at DESC);
CREATE INDEX idx_diary_book        ON diary_entry (book_id);
CREATE INDEX idx_user_follow_followee ON user_follow (followee_id);
CREATE INDEX idx_author_follow_author ON author_follow (author_id);

-- ---------------------------------------------------------------------
-- Convenience view: one row per book with its authors and genres
-- ---------------------------------------------------------------------
CREATE VIEW book_summary AS
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
                      WHERE bg.book_id = b.book_id ORDER BY g.name), '{}') AS genres
FROM book b;
