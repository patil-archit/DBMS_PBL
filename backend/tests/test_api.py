"""
End-to-end API test against a COPY of the database.

    dropdb --if-exists booklog_test && createdb booklog_test
    pg_dump booklog | psql -q booklog_test
    DATABASE_URL=postgresql://localhost:5432/booklog_test backend/venv/bin/python backend/tests/test_api.py

Firebase sign-in is replaced by an `X-Test-User` header so we can act as
several users. Test users are deleted at the end.
"""
import os
import sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
os.chdir(os.path.dirname(HERE))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()
assert "booklog_test" in os.environ.get("DATABASE_URL", ""), "Run against booklog_test, not the real database"

from fastapi import Request  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import deps, graph, sync_worker  # noqa: E402
from app.database import current_viewer, db  # noqa: E402
from app.main import app  # noqa: E402


async def fake_viewer(request: Request):
    uid = request.headers.get("X-Test-User")
    if not uid:
        current_viewer.set((0, "anon"))
        return None
    row = deps.ensure_user(uid, uid.replace("test_", "t_"), f"{uid}@example.test")
    v = deps.Viewer(row["user_id"], uid, row["username"], row["role"])
    current_viewer.set((v.user_id, v.role))
    return v


app.dependency_overrides[deps.viewer_optional] = fake_viewer
PASS = 0


def check(cond, msg):
    global PASS
    if not cond:
        raise AssertionError(msg)
    PASS += 1
    print(f"  ok  {msg}")


def as_(uid):
    return {"X-Test-User": uid}


A, B, C, MOD = "test_alice", "test_bob", "test_cara", "test_mod"

with db.cursor(system=True) as cur:  # leftovers from an aborted run
    cur.execute("DELETE FROM users WHERE firebase_uid LIKE 'test_%%'")
    # Neo4j and MongoDB are shared with the real database: give test users ids
    # far above real ones so they can never collide
    cur.execute("SELECT setval('users_user_id_seq', GREATEST(1000000, (SELECT max(user_id) FROM users)))")
graph.run("MATCH (u:User) WHERE u.user_id >= 1000000 OR u.username STARTS WITH 't_' OR u.username = 'alice_reads' "
          "DETACH DELETE u")

with TestClient(app) as c:
    print("health:", c.get("/health").json())

    # ---- accounts ---------------------------------------------------------
    me_a = c.get("/me", headers=as_(A)).json()
    me_b = c.get("/me", headers=as_(B)).json()
    c.get("/me", headers=as_(C))
    check(me_a["username"].startswith("t_alice"), "user created on first request with a username handle")
    r = c.patch("/me", json={"username": me_b["username"]}, headers=as_(A))
    check(r.status_code == 409, "duplicate username rejected")
    r = c.patch("/me", json={"bio": "I read a lot", "username": "alice_reads"}, headers=as_(A))
    check(r.json()["username"] == "alice_reads", "edit profile")
    alice, bob, cara = "alice_reads", me_b["username"], c.get("/me", headers=as_(C)).json()["username"]
    r = c.put("/me/genres", json={"genres": ["Fantasy", "Mystery"]}, headers=as_(A))
    check(sorted(r.json()["favourite_genres"]) == ["Fantasy", "Mystery"], "favourite genres saved")

    # ---- catalogue ----------------------------------------------------------
    hp = c.get("/search", params={"q": "hary pottr"}).json()["books"][0]
    check("Harry Potter" in hp["title"], "typo-tolerant search")
    flt = c.get("/search", params={"genre": "Horror", "min_rating": 4}).json()["books"]
    check(flt and all("Horror" in b["categories"] and b["average_rating"] >= 4 for b in flt), "search filters (genre + rating)")
    book = c.get(f"/book/{hp['title']}", headers=as_(A)).json()
    bid = book["book_id"]
    check(book["my_entries"] == [], "book page has no diary entries yet")

    # ---- diary + triggers ------------------------------------------------
    before = book["ratings_count"]
    r = c.post("/diary", json={"book_id": bid, "rating": 4.3}, headers=as_(A))
    check(r.status_code == 422, "rating 4.3 rejected by API validation")
    c.put(f"/shelves/{bid}", json={"status": "currently_reading"}, headers=as_(A))
    check(c.get(f"/book/{hp['title']}", headers=as_(A)).json()["shelf_status"] == "currently_reading", "shelf set")
    c.put("/me/goal", json={"year": date.today().year, "target_books": 10}, headers=as_(A))
    e1 = c.post("/diary", json={"book_id": bid, "rating": 4.5, "review_text": "Magical!", "is_liked": True},
                headers=as_(A)).json()
    after = c.get(f"/book/{hp['title']}", headers=as_(A)).json()
    check(after["ratings_count"] == before + 1, "trigger updated ratings_count")
    check(after["shelf_status"] is None, "logging a book removes it from currently-reading")
    goal = c.get("/me/goal", headers=as_(A)).json()
    check(goal["books_finished"] == 1 and goal["percent"] == 10, "reading goal progress updated by trigger")
    r = c.patch(f"/diary/{e1['entry_id']}", json={"rating": 5}, headers=as_(A))
    check(r.json()["rating"] == 5, "edit diary entry")
    r = c.patch(f"/diary/{e1['entry_id']}", json={"rating": 1}, headers=as_(B))
    check(r.status_code == 404, "cannot edit someone else's entry")
    e_b = c.post("/diary", json={"book_id": bid, "rating": 4, "review_text": "Good"}, headers=as_(B)).json()

    # ---- reviews: likes, comments, reports --------------------------------
    r = c.post(f"/reviews/{e1['entry_id']}/like", headers=as_(B)).json()
    check(r["liked"] and r["like_count"] == 1, "like a review")
    r = c.post(f"/reviews/{e1['entry_id']}/comments", json={"text": "Agreed!"}, headers=as_(B))
    check(r.status_code == 200, "comment on a review")
    revs = c.get(f"/books/{bid}/reviews", headers=as_(A)).json()
    check(any(x["entry_id"] == e1["entry_id"] and x["comment_count"] == 1 for x in revs), "reviews list with counts")
    r = c.post(f"/reviews/{e1['entry_id']}/report", json={"reason": "spam"}, headers=as_(A))
    check(r.status_code == 400, "cannot report own review")
    r = c.post(f"/reviews/{e_b['entry_id']}/report", json={"reason": "spoilers"}, headers=as_(A))
    check(r.status_code == 200, "report a review")

    # ---- privacy (row-level security) --------------------------------------
    c.patch("/me", json={"is_private": True}, headers=as_(B))
    check(c.get(f"/users/{bob}/diary", headers=as_(A)).json() == [], "private diary hidden from others (RLS)")
    check(len(c.get(f"/users/{bob}/diary", headers=as_(B)).json()) == 1, "owner still sees own private diary")
    check(all(x["entry_id"] != e_b["entry_id"] for x in c.get(f"/books/{bid}/reviews").json()),
          "private review hidden on book page")
    c.patch("/me", json={"is_private": False}, headers=as_(B))

    # ---- lists --------------------------------------------------------------
    others = [b["book_id"] for b in c.get("/search", params={"q": "agatha christie"}).json()["books"][:3]]
    lst = c.post("/lists", json={"name": "Cosy mysteries", "book_ids": others}, headers=as_(A)).json()
    check([b["position"] for b in lst["books"]] == [1, 2, 3], "list created with ranked books")
    lst = c.put(f"/lists/{lst['list_id']}/order", json={"book_ids": others[::-1]}, headers=as_(A)).json()
    check([b["book_id"] for b in lst["books"]] == others[::-1], "list re-ranked (deferred unique constraint)")
    lst = c.delete(f"/lists/{lst['list_id']}/books/{others[0]}", headers=as_(A)).json()
    check([b["position"] for b in lst["books"]] == [1, 2], "remove book closes position gap")
    check(c.post(f"/lists/{lst['list_id']}/like", headers=as_(B)).json()["like_count"] == 1, "like a list")
    c.post(f"/lists/{lst['list_id']}/comments", json={"text": "Great list"}, headers=as_(B))
    check(len(c.get(f"/lists/{lst['list_id']}/comments").json()) == 1, "comment on a list")
    priv = c.post("/lists", json={"name": "Secret", "is_public": False}, headers=as_(A)).json()
    check(c.get(f"/lists/{priv['list_id']}", headers=as_(B)).status_code == 404, "private list hidden")
    r = c.patch(f"/lists/{lst['list_id']}", json={"name": "Hacked"}, headers=as_(B))
    check(r.status_code == 404, "cannot edit someone else's list")

    # ---- social -------------------------------------------------------------
    check(c.post(f"/users/{bob}/follow", headers=as_(A)).status_code == 200, "follow user")
    c.post(f"/users/{cara}/follow", headers=as_(B))
    c.post(f"/users/{alice}/follow", headers=as_(B))
    check(c.post(f"/users/{alice}/follow", headers=as_(A)).status_code == 400, "cannot follow yourself")
    feed = c.get("/feed", headers=as_(A)).json()
    check(any(f["username"] == bob and f["kind"] == "logged" for f in feed), "activity feed shows followed users' logs")
    check(any(f["username"] == alice and f["kind"] == "listed" for f in c.get("/feed", headers=as_(B)).json()),
          "feed shows list additions")
    found = c.get("/people/search", params={"q": "alice"}, headers=as_(B)).json()
    check(any(u["username"] == alice for u in found), "search users")

    # Neo4j sync through the outbox
    applied = sync_worker.process_once()
    check(all(s["pending"] == 0 for s in sync_worker.status() if s["target"] == "neo4j"),
          f"outbox synced to Neo4j ({applied} ops)")
    sug = c.get("/people/suggestions", headers=as_(A)).json()
    check(sug["source"] == "neo4j" and any(p["username"] == cara for p in sug["people"]),
          "people you may know (friends of friends, Neo4j)")
    prof = c.get(f"/users/{cara}", headers=as_(A)).json()
    check(prof["network"]["steps"] == 2, "steps apart = 2 (Neo4j shortestPath)")
    prof = c.get(f"/users/{bob}", headers=as_(A)).json()
    check(prof["network"]["shared_books"] == 1 and prof["network"]["match_percent"] > 0,
          f"taste match {prof['network']['match_percent']}%")

    recs = c.get("/recommendations", params={"refresh": True}, headers=as_(A)).json()
    check(len(recs) >= 10 and all(r.get("reason") for r in recs), "recommendations each have a reason")
    check(bid not in [r["book_id"] for r in recs], "recommendations exclude logged books")
    print("     reasons:", sorted({r["source"] for r in recs}))

    # ---- moderation & admin ----------------------------------------------------
    check(c.get("/admin/reports", headers=as_(A)).status_code == 403, "readers can't see the moderation queue")
    with db.cursor(system=True) as cur:
        cur.execute("UPDATE users SET role = 'moderator' WHERE firebase_uid = %s", (A,))
        cur.execute("SELECT user_id FROM users WHERE firebase_uid = %s", (MOD,))
    reps = c.get("/admin/reports", headers=as_(A)).json()
    check(len(reps) == 1 and reps[0]["reason"] == "spoilers", "moderator sees report queue")
    c.post(f"/admin/reports/{reps[0]['report_id']}/resolve", json={"action": "remove"}, headers=as_(A))
    check(c.get(f"/users/{bob}/diary", headers=as_(B)).json() == [], "moderator removed reported review")
    check(c.post("/admin/books", json={"title": "x"}, headers=as_(A)).status_code == 403, "moderator can't edit catalogue")

    with db.cursor(system=True) as cur:
        cur.execute("UPDATE users SET role = 'admin' WHERE firebase_uid = %s", (A,))
    nb = c.post("/admin/books", json={"title": "Test Book Zeta", "authors": ["Test Author Q"], "genres": ["Fantasy"],
                                      "pub_year": 2020, "page_count": 123}, headers=as_(A)).json()
    check(nb["authors"] == ["Test Author Q"], "admin adds a book with author + genre")
    nb = c.put(f"/admin/books/{nb['book_id']}", json={**{k: nb[k] for k in ("title", "pub_year", "page_count")},
                                                     "subtitle": "Edited"}, headers=as_(A)).json()
    check(nb["subtitle"] == "Edited", "admin edits a book")
    r = c.post("/admin/books", json={"title": "Bad", "page_count": -5}, headers=as_(A))
    check(r.status_code == 422, "invalid page count rejected")
    c.delete(f"/admin/books/{nb['book_id']}", headers=as_(A))
    audit = c.get("/admin/audit", params={"table": "book"}, headers=as_(A)).json()
    check([a["operation"] for a in audit[:3]] == ["DELETE", "UPDATE", "INSERT"] and audit[0]["changed_by"] == alice,
          "audit log records who changed books")
    an = c.get("/admin/analytics", headers=as_(A)).json()
    check(an["most_read"] and an["active_users"] and an["genre_trends"], "reports from materialized views")
    authors_cleanup = c.get("/admin/authors", params={"q": "Test Author Q"}, headers=as_(A)).json()
    for a in authors_cleanup:
        c.delete(f"/admin/authors/{a['author_id']}", headers=as_(A))

    # ---- discover: browse, random, book of the day, stats ------------------
    br = c.get("/discover/browse", params={"genre": "Fantasy", "sort": "rating", "limit": 10}).json()
    check(br["total"] > 0 and all("Fantasy" in b["categories"] for b in br["books"]), "browse by genre")
    p2 = c.get("/discover/browse", params={"genre": "Fantasy", "sort": "rating", "limit": 10, "offset": 10}).json()
    check(not {b["book_id"] for b in br["books"]} & {b["book_id"] for b in p2["books"]}, "browse pages don't overlap")
    rnd = c.get("/discover/random", params={"genre": "Fantasy"}).json()
    check("Fantasy" in rnd["categories"] and rnd["average_rating"] >= 3.5, "surprise me picks a well-rated book in the genre")
    check(c.get("/discover/today").json()["book_id"] == c.get("/discover/today").json()["book_id"], "book of the day is stable")
    st = c.get("/discover/stats").json()
    check(st["books"] > 0 and st["decades"], "catalogue stats and timeline")
    fa = c.get("/discover/authors", params={"limit": 5}).json()
    check(fa and all(a["photo_url"] for a in fa), "featured authors with portraits")
    gi = c.get("/discover/genres").json()
    check(all("/b/id/" in u for g in gi for u in (g["covers"] or [])), "genre tiles use real cover ids")
    rs = c.get("/users/alice_reads/stats", headers=as_(B)).json()
    check(rs["totals"]["books"] >= 1 and rs["genres"], "reading stats for a public diary")
    with db.cursor(system=True) as cur:
        cur.execute("UPDATE users SET is_private = TRUE WHERE username = %s", (cara,))
    c.post("/diary", json={"book_id": bid, "rating": 4, "date_read": "2026-03-01"}, headers=as_(C))
    check(c.get(f"/users/{cara}/stats", headers=as_(B)).json()["totals"]["entries"] == 0, "reading stats respect private diaries (RLS)")
    own = c.get(f"/users/{cara}/stats", params={"year": 2026}, headers=as_(C)).json()
    check(own["totals"]["entries"] == 1 and own["months"][0]["month"] == 3, "owner sees own reading stats by month")
    c.post("/diary", json={"book_id": bid, "rating": 3, "review_text": "Secret thoughts from a private diary."}, headers=as_(C))
    c.post("/diary", json={"book_id": bid, "rating": 5, "review_text": "A public review everyone should see."}, headers=as_(B))
    jr = c.get("/discover/journal", params={"limit": 24}).json()
    check(any(j["username"] == bob for j in jr) and all(j["username"] != cara for j in jr),
          "journal shows public reviews and hides private diaries (RLS)")

    # ---- flips & public takes (MongoDB + follow graph for private accounts) --
    fy = c.get("/flips", params={"limit": 5}).json()
    check(len(fy) == 5 and all(r["book"]["thumbnail"] and isinstance(r["takes"], list) for r in fy), "flips feed for anonymous readers")
    check(len(c.get("/reels", params={"limit": 2}).json()) == 2, "old /reels path still works")
    pub = c.post("/takes", json={"book_id": bid, "text": "Everyone can read this one", "vibe": "must_read"}, headers=as_(B))
    pid = pub.json()["take_id"]
    check(pid in [t["take_id"] for t in c.get(f"/books/{bid}/takes").json()], "a public account's take is seen by anonymous readers")
    seen_a = c.get(f"/books/{bid}/takes", headers=as_(A)).json()
    check(any(t["take_id"] == pid and t["username"] == bob for t in seen_a), "everyone sees who said what")
    check(c.post(f"/takes/{pid}/like", headers=as_(A)).json() == {"liked": True, "likes": 1}, "anyone signed in can like a public take")
    lat = c.get("/flips", params={"mode": "latest"}).json()
    check(lat and lat[0]["book"]["book_id"] == bid, "latest flips show the book just talked about")
    check(c.delete(f"/takes/{pid}", headers=as_(B)).status_code == 204, "delete own public take")
    # Cara is a private account here: her takes stay with her followers
    tk = c.post("/takes", json={"book_id": bid, "text": "Fun fact: written in a shed", "vibe": "fun_fact"}, headers=as_(C))
    check(tk.status_code == 201 and tk.json()["mine"], "post a take")
    tid = tk.json()["take_id"]
    check(c.post("/takes", json={"book_id": bid, "text": "x", "vibe": "nope"}, headers=as_(C)).status_code == 422, "unknown vibe rejected")
    check(c.post("/takes", json={"book_id": bid, "text": "hi"}).status_code == 401, "posting needs sign-in")
    seen_b = c.get(f"/books/{bid}/takes", headers=as_(B)).json()   # Bob follows Cara
    check([t["take_id"] for t in seen_b] == [tid], "followers see a private account's take")
    check(c.get(f"/books/{bid}/takes", headers=as_(A)).json() == [], "non-followers don't see a private account's take")
    check(c.get(f"/books/{bid}/takes").json() == [], "anonymous readers don't see a private account's take")
    fol = c.get("/flips", params={"mode": "following"}, headers=as_(B)).json()
    check(fol and fol[0]["book"]["book_id"] == bid and fol[0]["takes"][0]["take_id"] == tid, "following flips show books with takes")
    check(c.post(f"/takes/{tid}/like", headers=as_(B)).json() == {"liked": True, "likes": 1}, "followers can like a take")
    check(c.post(f"/takes/{tid}/like", headers=as_(A)).status_code == 404, "non-followers can't like a private account's take")
    check(c.delete(f"/takes/{tid}", headers=as_(B)).status_code == 403, "can't delete someone else's take")
    c.post("/takes", json={"book_id": bid, "text": "Second take"}, headers=as_(C))
    check(c.delete(f"/takes/{tid}", headers=as_(C)).status_code == 204, "delete own take")

    # ---- messages, notifications, presence, reading now ------------------
    r = c.post(f"/messages/{cara}", json={"text": "Have you read this one?", "book_id": bid}, headers=as_(B))
    check(r.status_code == 201 and r.json()["book"]["book_id"] == bid, "send a message with a book attached")
    check(c.post(f"/messages/{bob}", json={"text": "Not yet!"}, headers=as_(C)).status_code == 201, "reply (one-way follow is enough)")
    check(c.post(f"/messages/{cara}", json={"text": "hi"}, headers=as_(A)).status_code == 403, "can't message strangers")
    check(c.post(f"/messages/{cara}", json={}, headers=as_(B)).status_code == 422, "empty message rejected")
    th = c.get("/messages", headers=as_(B)).json()
    check(th[0]["username"] == cara and th[0]["unread"] == 1 and th[0]["last"]["text"] == "Not yet!", "inbox threads with unread count")
    check(c.get("/me/pulse", headers=as_(B)).json()["messages"] == 1, "pulse returns unread messages")
    conv = c.get(f"/messages/{cara}", headers=as_(B)).json()
    check([m["mine"] for m in conv["messages"]] == [True, False] and conv["can_message"], "conversation in order")
    c.post(f"/messages/{cara}/read", headers=as_(B))
    check(c.get("/me/pulse", headers=as_(B)).json()["messages"] == 0, "mark conversation read")
    check(c.get(f"/messages/{bob}", headers=as_(C)).json()["online"], "presence: active readers show as online")
    check({x["username"] for x in c.get("/messages/contacts", headers=as_(B)).json()} >= {cara, alice}, "contacts are follows + followers")
    nots = c.get("/notifications", headers=as_(A)).json()
    check(any(n["kind"] == "follow" and n["actor"] == bob for n in nots), "notifications: new follower")
    check(c.get("/me/pulse", headers=as_(A)).json()["notifications"] >= 1, "unread notification count")
    c.post("/notifications/seen", headers=as_(A))
    check(c.get("/me/pulse", headers=as_(A)).json()["notifications"] == 0 and not any(n["unread"] for n in c.get("/notifications", headers=as_(A)).json()),
          "notifications marked seen")
    c.put(f"/shelves/{rnd['book_id']}", json={"status": "currently_reading"}, headers=as_(A))
    rn = c.get("/people/reading-now", headers=as_(B)).json()
    check(any(x["username"] == alice and x["book_id"] == rnd["book_id"] for x in rn), "reading now: what people you follow are reading")
    rd = c.get(f"/books/{rnd['book_id']}/readers-now", headers=as_(B)).json()
    check(rd["count"] >= 1 and alice in rd["friends"], "readers now on a book, friends first")

    # ---- export & delete account ------------------------------------------
    exp = c.get("/me/export", headers=as_(A)).json()
    check(exp["diary"] and exp["lists"] and exp["following"] == [bob], "export my data")
    r = c.post("/chat/messages", json={"content": "hi"}, headers=as_(A))
    check(r.status_code in (200, 503, 502), f"chat endpoint responds ({r.status_code})")
    if r.status_code == 200:
        print("     bot:", r.json()["reply"][:120])

    for uid in (A, B, C, MOD):
        c.delete("/me", headers=as_(uid))
    with db.cursor(system=True) as cur:
        cur.execute("SELECT count(*) AS n FROM users WHERE firebase_uid LIKE 'test_%%'")
        check(cur.fetchone()["n"] == 0, "accounts deleted (cascade)")
        cur.execute("SELECT count(*) AS n FROM diary_entry d WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = d.user_id)")
        check(cur.fetchone()["n"] == 0, "no orphaned diary rows")
    sync_worker.process_once()
    check(graph.run("MATCH (u:User) WHERE u.user_id >= 1000000 RETURN count(u) AS n")[0]["n"] == 0,
          "deleted users removed from Neo4j via outbox")
    from app import mongo
    check(mongo.get_db().book_takes.count_documents({"user_id": {"$gte": 1000000}}) == 0, "deleted users' takes removed from MongoDB")
    check(mongo.get_db().messages.count_documents({"from": {"$gte": 1000000}}) == 0, "deleted users' messages removed from MongoDB")

print(f"\nALL {PASS} CHECKS PASSED")
