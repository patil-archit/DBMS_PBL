"""
Accounts, profiles, following, activity feed and the social graph.
"""
import re

from fastapi import HTTPException
from firebase_admin import auth as firebase_auth

from app import graph, mongo
from app.database import db
from app.services import book_service, diary_service, list_service

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,30}$")


def _user_by_username(cur, username):
    cur.execute("SELECT user_id, username, bio, language, is_private, role, created_at FROM users WHERE username = %s",
                (username,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(404, "User not found")
    return row


# =====================================================================
# ME
# =====================================================================

def get_me(viewer):
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT u.user_id, u.username, u.email, u.bio, u.language, u.is_private, u.role,
                   u.friend_code, u.created_at,
                   ARRAY(SELECT g.name FROM user_genre ug JOIN genre g USING (genre_id)
                         WHERE ug.user_id = u.user_id ORDER BY g.name) AS favourite_genres
            FROM users u WHERE u.user_id = %s
            """,
            (viewer.user_id,),
        )
        return cur.fetchone()


def update_me(viewer, fields):
    allowed = {k: v for k, v in fields.items() if k in ("username", "bio", "language", "is_private") and v is not None}
    if "username" in allowed:
        allowed["username"] = allowed["username"].strip().lower()
        if not USERNAME_RE.match(allowed["username"]):
            raise HTTPException(400, "Username must be 3-30 characters: lowercase letters, digits or _")
    if "bio" in allowed:
        allowed["bio"] = allowed["bio"].strip()[:1000] or None
    if allowed:
        with db.cursor() as cur:
            if "username" in allowed:
                cur.execute("SELECT 1 FROM users WHERE username = %s AND user_id <> %s",
                            (allowed["username"], viewer.user_id))
                if cur.fetchone():
                    raise HTTPException(409, "That username is taken")
            sets = ", ".join(f"{k} = %({k})s" for k in allowed)
            cur.execute(f"UPDATE users SET {sets} WHERE user_id = %(id)s", {**allowed, "id": viewer.user_id})
    return get_me(viewer)


def set_favourite_genres(viewer, genre_names):
    with db.cursor() as cur:
        cur.execute("DELETE FROM user_genre WHERE user_id = %s", (viewer.user_id,))
        cur.execute(
            """INSERT INTO user_genre (user_id, genre_id)
               SELECT %s, genre_id FROM genre WHERE name = ANY(%s)""",
            (viewer.user_id, list(genre_names)),
        )
    mongo.clear_recommendations(viewer.user_id)
    return get_me(viewer)


def delete_account(viewer):
    """
    Deletes the user and, through ON DELETE CASCADE, every diary entry, list,
    comment, like, follow, shelf and goal in one transaction. A trigger queues
    the Neo4j and MongoDB cleanup in the sync outbox. Finally the Firebase
    login is removed.
    """
    with db.cursor() as cur:
        cur.execute("DELETE FROM users WHERE user_id = %s", (viewer.user_id,))
    try:
        firebase_auth.delete_user(viewer.uid)
    except Exception as e:
        print(f"Firebase user delete failed for {viewer.uid}: {e}")


def export_data(viewer):
    """Everything we store about the user, as JSON (privacy requirement)."""
    me = get_me(viewer)
    with db.cursor() as cur:
        cur.execute("SELECT u.username FROM user_follow f JOIN users u ON u.user_id = f.followee_id WHERE f.follower_id = %s",
                    (viewer.user_id,))
        following = [r["username"] for r in cur.fetchall()]
        cur.execute("SELECT u.username FROM user_follow f JOIN users u ON u.user_id = f.follower_id WHERE f.followee_id = %s",
                    (viewer.user_id,))
        followers = [r["username"] for r in cur.fetchall()]
        cur.execute("SELECT c.comment_text, c.created_at, c.entry_id, c.list_id FROM comment c WHERE c.user_id = %s",
                    (viewer.user_id,))
        comments = cur.fetchall()
        cur.execute("SELECT year, target_books, books_finished FROM reading_goal WHERE user_id = %s", (viewer.user_id,))
        goals = cur.fetchall()
    chats = []
    try:
        chats = list(mongo.get_db().chat_sessions.find({"user_id": viewer.user_id}, {"_id": 0}))
    except Exception:
        pass
    return {
        "profile": me,
        "diary": diary_service.get_diary(viewer.user_id),
        "shelves": diary_service.get_shelves(viewer.user_id, viewer.user_id),
        "lists": [list_service.get_list(l["list_id"]) for l in list_service.user_lists(viewer.user_id)],
        "reading_goals": goals,
        "comments": comments,
        "following": following,
        "followers": followers,
        "followed_authors": [a["name"] for a in book_service.get_followed_authors(viewer.user_id)],
        "chat_history": chats,
    }


# =====================================================================
# PROFILES
# =====================================================================

def get_profile(username, viewer=None):
    with db.cursor() as cur:
        user = _user_by_username(cur, username)
        uid = user["user_id"]
        cur.execute(
            """
            SELECT (SELECT count(*) FROM user_follow WHERE followee_id = %(u)s) AS followers,
                   (SELECT count(*) FROM user_follow WHERE follower_id = %(u)s) AS following,
                   (SELECT count(*) FROM diary_entry WHERE user_id = %(u)s) AS entries,
                   (SELECT count(DISTINCT book_id) FROM diary_entry WHERE user_id = %(u)s) AS books,
                   (SELECT count(*) FROM diary_entry WHERE user_id = %(u)s AND review_text IS NOT NULL) AS reviews,
                   (SELECT count(*) FROM list l WHERE l.user_id = %(u)s AND (l.is_public OR l.user_id = app_user_id())) AS lists,
                   EXISTS (SELECT 1 FROM user_follow WHERE follower_id = app_user_id() AND followee_id = %(u)s) AS is_following,
                   EXISTS (SELECT 1 FROM user_follow WHERE follower_id = %(u)s AND followee_id = app_user_id()) AS follows_you
            """,
            {"u": uid},
        )
        stats = cur.fetchone()
    is_me = bool(viewer and viewer.user_id == uid)
    hidden = user["is_private"] and not is_me and not (viewer and viewer.is_staff)
    profile = {**user, **stats, "is_me": is_me, "diary_hidden": hidden}
    if viewer and not is_me:
        profile["network"] = network_between(viewer.user_id, uid)
    return profile


def network_between(me, other):
    """Steps apart + taste match (Neo4j), with a SQL fallback for steps."""
    try:
        return {**graph.taste_match(me, other), "steps": graph.steps_apart(me, other), "source": "neo4j"}
    except graph.GraphUnavailable:
        return {"steps": _steps_sql(me, other), "match_percent": None, "shared_books": None, "source": "postgres"}


def _steps_sql(a, b, max_depth=4):
    with db.cursor() as cur:
        cur.execute(
            """
            WITH RECURSIVE edges AS (
                SELECT follower_id AS a, followee_id AS b FROM user_follow
                UNION SELECT followee_id, follower_id FROM user_follow
            ),
            walk(user_id, depth, path) AS (
                SELECT %(a)s, 0, ARRAY[%(a)s]
                UNION ALL
                SELECT e.b, w.depth + 1, w.path || e.b
                FROM walk w JOIN edges e ON e.a = w.user_id
                WHERE w.depth < %(max)s AND NOT e.b = ANY (w.path)
            )
            SELECT min(depth) AS steps FROM walk WHERE user_id = %(b)s
            """,
            {"a": a, "b": b, "max": max_depth},
        )
        return cur.fetchone()["steps"]


def search_users(q, limit=20):
    q = (q or "").strip().lower()
    if not q:
        return []
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT u.username, u.bio, u.friend_code = %(q)s AS code_match,
                   (SELECT count(*) FROM user_follow WHERE followee_id = u.user_id) AS followers,
                   EXISTS (SELECT 1 FROM user_follow WHERE follower_id = app_user_id() AND followee_id = u.user_id) AS is_following
            FROM users u
            WHERE (u.username %% %(q)s OR u.username LIKE '%%' || %(q)s || '%%' OR u.friend_code = %(q)s)
              AND u.user_id <> COALESCE(app_user_id(), 0)
            ORDER BY code_match DESC, similarity(u.username, %(q)s) DESC
            LIMIT %(limit)s
            """,
            {"q": q, "limit": limit},
        )
        return cur.fetchall()


# =====================================================================
# FOLLOWING
# =====================================================================

def follow(viewer, username):
    with db.cursor() as cur:
        target = _user_by_username(cur, username)
        if target["user_id"] == viewer.user_id:
            raise HTTPException(400, "You can't follow yourself")
        cur.execute("INSERT INTO user_follow (follower_id, followee_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (viewer.user_id, target["user_id"]))
    mongo.clear_recommendations(viewer.user_id)


def unfollow(viewer, username):
    with db.cursor() as cur:
        target = _user_by_username(cur, username)
        cur.execute("DELETE FROM user_follow WHERE follower_id = %s AND followee_id = %s",
                    (viewer.user_id, target["user_id"]))
    mongo.clear_recommendations(viewer.user_id)


def follow_list(username, direction):
    """direction: 'followers' or 'following'."""
    join, where = ("follower_id", "followee_id") if direction == "followers" else ("followee_id", "follower_id")
    with db.cursor() as cur:
        user = _user_by_username(cur, username)
        cur.execute(
            f"""
            SELECT u.username, u.bio,
                   EXISTS (SELECT 1 FROM user_follow x WHERE x.follower_id = app_user_id() AND x.followee_id = u.user_id) AS is_following
            FROM user_follow f JOIN users u ON u.user_id = f.{join}
            WHERE f.{where} = %s ORDER BY f.created_at DESC
            """,
            (user["user_id"],),
        )
        return cur.fetchall()


def suggestions(viewer):
    """People you may know: friends of friends (Neo4j), SQL fallback."""
    try:
        rows = graph.people_you_may_know(viewer.user_id)
        source = "neo4j"
    except graph.GraphUnavailable:
        source = "postgres"
        with db.cursor() as cur:
            cur.execute(
                """
                SELECT fof.user_id, fof.username, count(DISTINCT f.followee_id) AS mutual,
                       (array_agg(DISTINCT mid.username))[1:3] AS via
                FROM user_follow f
                JOIN users mid ON mid.user_id = f.followee_id
                JOIN user_follow f2 ON f2.follower_id = f.followee_id
                JOIN users fof ON fof.user_id = f2.followee_id
                WHERE f.follower_id = %(me)s AND fof.user_id <> %(me)s
                  AND NOT EXISTS (SELECT 1 FROM user_follow x WHERE x.follower_id = %(me)s AND x.followee_id = fof.user_id)
                GROUP BY fof.user_id ORDER BY mutual DESC LIMIT 8
                """,
                {"me": viewer.user_id},
            )
            rows = cur.fetchall()
    for r in rows:
        try:
            r["match_percent"] = graph.taste_match(viewer.user_id, r["user_id"])["match_percent"]
        except graph.GraphUnavailable:
            r["match_percent"] = None
    return {"source": source, "people": rows}


# =====================================================================
# FEED
# =====================================================================

def get_feed(viewer, limit=50):
    """What people you follow logged, rated, reviewed and listed (newest first)."""
    with db.cursor() as cur:
        cur.execute(
            f"""
            WITH following AS (SELECT followee_id AS user_id FROM user_follow WHERE follower_id = %(me)s)
            SELECT * FROM (
                SELECT 'logged' AS kind, d.created_at AS ts, u.username,
                       d.entry_id, d.rating, d.review_text, d.is_liked,
                       NULL::int AS list_id, NULL::text AS list_name,
                       {book_service.BOOK_CARD}
                FROM diary_entry d
                JOIN following f ON f.user_id = d.user_id
                JOIN users u ON u.user_id = d.user_id
                JOIN book_summary bs ON bs.book_id = d.book_id
                UNION ALL
                SELECT 'listed', lb.added_at, u.username,
                       NULL, NULL, NULL, NULL,
                       l.list_id, l.name,
                       {book_service.BOOK_CARD}
                FROM list_book lb
                JOIN list l ON l.list_id = lb.list_id AND l.is_public
                JOIN following f ON f.user_id = l.user_id
                JOIN users u ON u.user_id = l.user_id
                JOIN book_summary bs ON bs.book_id = lb.book_id
            ) feed
            ORDER BY ts DESC LIMIT %(limit)s
            """,
            {"me": viewer.user_id, "limit": limit},
        )
        return cur.fetchall()
