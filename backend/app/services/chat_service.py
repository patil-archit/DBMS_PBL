"""
Book chatbot (OpenAI) with conversation history in MongoDB.

Reliability rule from the SRS: the bot may only recommend books that exist
in our database. The model never sees the catalogue directly; it calls the
`search_books` tool (SQL against PostgreSQL) and then `show_books` with the
ids it picked. Ids that the database did not return are dropped, so the
cards shown to the user are always real catalogue books.
"""
import json
import os
import uuid

from fastapi import HTTPException

from app import mongo
from app.database import db
from app.services.book_service import BOOK_CARD

MAX_TOOL_ROUNDS = 5
HISTORY_MESSAGES = 16

SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "search_books",
        "description": (
            "Search the BookLog catalogue (PostgreSQL). Combine parameters freely. "
            "Call it several times with different parameters to collect enough good candidates."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "similar_to_title": {"type": "string", "description": "A book the user mentions ('like Harry Potter'). Finds books sharing its genres, by OTHER authors unless include_same_author is true."},
                "include_same_author": {"type": "boolean", "description": "Also return books by the same author/series as similar_to_title (default false)"},
                "text": {"type": "string", "description": "Themes, moods or plot words matched against titles, genres and descriptions, e.g. 'magic school', 'space war', 'cosy village murder'. Do NOT put a book title here."},
                "genres": {"type": "array", "items": {"type": "string"}, "description": "Genre names exactly as in the catalogue's genre list; a book must match at least one"},
                "author": {"type": "string", "description": "Only books by this author"},
                "min_rating": {"type": "number"},
                "max_pages": {"type": "integer"},
                "min_pages": {"type": "integer"},
                "published_after": {"type": "integer"},
                "published_before": {"type": "integer"},
                "exclude_book_ids": {"type": "array", "items": {"type": "integer"}, "description": "Books to skip, e.g. ones already shown in this conversation"},
                "exclude_already_read": {"type": "boolean", "description": "Skip books the user has logged (default true)"},
                "limit": {"type": "integer", "description": "Max results, up to 15"},
            },
        },
    },
}

SHOW_TOOL = {
    "type": "function",
    "function": {
        "name": "show_books",
        "description": "Display your recommendations to the user as book cards. This is how every recommendation reply ends.",
        "parameters": {
            "type": "object",
            "properties": {
                "intro": {"type": "string", "description": "One short friendly sentence shown above the cards"},
                "books": {
                    "type": "array",
                    "description": "3 to 8 books, best first, each with a book_id returned by search_books",
                    "items": {
                        "type": "object",
                        "properties": {
                            "book_id": {"type": "integer"},
                            "reason": {"type": "string", "description": "Max 15 words: why this fits the request"},
                        },
                        "required": ["book_id", "reason"],
                    },
                },
            },
            "required": ["intro", "books"],
        },
    },
}


def _client():
    key = os.getenv("OPENAI_API_KEY", "").strip()
    if not key:
        raise HTTPException(503, "The chatbot isn't set up yet: add OPENAI_API_KEY to backend/.env and restart the backend.")
    from openai import OpenAI
    return OpenAI(api_key=key)


def _genre_names():
    with db.cursor() as cur:
        cur.execute("SELECT name FROM genre ORDER BY name")
        return [r["name"] for r in cur.fetchall()]


def search_books_tool(viewer, args: dict):
    """Runs the model's search request as parameterised SQL. Returns a list of book dicts."""
    limit = max(1, min(int(args.get("limit") or 10), 15))
    where, params = [], {"limit": limit, "me": viewer.user_id}
    score_parts = ["bs.avg_rating / 5", "ln(2 + bs.ratings_count) / 20"]

    if args.get("similar_to_title"):
        # The source book: best title match, preferring well-known books
        with db.cursor() as cur:
            cur.execute(
                """SELECT book_id FROM book
                   ORDER BY word_similarity(lower(%s), lower(title)) DESC, ratings_count DESC LIMIT 1""",
                (args["similar_to_title"],),
            )
            src = cur.fetchone()
        if src:
            params["src"] = src["book_id"]
            shared = """(SELECT count(*) FROM book_genre x JOIN book_genre y USING (genre_id)
                         WHERE x.book_id = bs.book_id AND y.book_id = %(src)s)"""
            where.append(f"bs.book_id <> %(src)s AND {shared} > 0")
            score_parts.append(f"1.5 * {shared}")
            if not args.get("include_same_author"):
                where.append("""NOT EXISTS (SELECT 1 FROM book_author a1 JOIN book_author a2 USING (author_id)
                                            WHERE a1.book_id = bs.book_id AND a2.book_id = %(src)s)""")

    text = (args.get("text") or "").strip().lower()
    if text:
        params["text"] = text
        where.append("""(word_similarity(%(text)s, lower(bs.title || ' ' || array_to_string(bs.genres, ' '))) > 0.3
                         OR to_tsvector('english', COALESCE(bs.description, '') || ' ' || array_to_string(bs.genres, ' '))
                            @@ websearch_to_tsquery('english', replace(%(text)s, ' ', ' or ')))""")
        score_parts.append("""2 * word_similarity(%(text)s, lower(bs.title || ' ' || array_to_string(bs.genres, ' ')))
                              + 3 * ts_rank(to_tsvector('english', COALESCE(bs.description, '') || ' ' || array_to_string(bs.genres, ' ')),
                                            websearch_to_tsquery('english', replace(%(text)s, ' ', ' or ')))""")
    if args.get("genres"):
        params["genres"] = [g.lower() for g in args["genres"]]
        where.append("EXISTS (SELECT 1 FROM unnest(bs.genres) g WHERE lower(g) = ANY(%(genres)s))")
        score_parts.append("(SELECT count(*) FROM unnest(bs.genres) g WHERE lower(g) = ANY(%(genres)s))")
    if args.get("author"):
        params["author"] = args["author"].lower()
        where.append("word_similarity(%(author)s, lower(array_to_string(bs.authors, ' '))) > 0.5")
    for key, sql in (("min_rating", "bs.avg_rating >= %(min_rating)s"), ("max_pages", "bs.page_count <= %(max_pages)s"),
                     ("min_pages", "bs.page_count >= %(min_pages)s"), ("published_after", "bs.pub_year >= %(published_after)s"),
                     ("published_before", "bs.pub_year <= %(published_before)s")):
        if args.get(key) is not None:
            params[key] = args[key]
            where.append(sql)
    if args.get("exclude_book_ids"):
        params["excl"] = [int(i) for i in args["exclude_book_ids"]]
        where.append("NOT (bs.book_id = ANY(%(excl)s))")
    if args.get("exclude_already_read", True):
        where.append("NOT EXISTS (SELECT 1 FROM diary_entry d WHERE d.user_id = %(me)s AND d.book_id = bs.book_id)")

    with db.cursor() as cur:
        cur.execute(
            f"""
            SELECT {BOOK_CARD}, bs.page_count, bs.pub_year, left(bs.description, 220) AS description
            FROM book_summary bs
            WHERE {' AND '.join(where) if where else 'TRUE'}
            ORDER BY ({' + '.join(score_parts)}) DESC
            LIMIT %(limit)s
            """,
            params,
        )
        return cur.fetchall()


def _system_prompt(viewer):
    with db.cursor() as cur:
        cur.execute(
            """SELECT b.title, d.rating FROM diary_entry d JOIN book b USING (book_id)
               WHERE d.user_id = %s ORDER BY d.created_at DESC LIMIT 10""",
            (viewer.user_id,),
        )
        recent = cur.fetchall()
        cur.execute(
            "SELECT g.name FROM user_genre ug JOIN genre g USING (genre_id) WHERE ug.user_id = %s", (viewer.user_id,)
        )
        favs = [r["name"] for r in cur.fetchall()]
    history = "; ".join(f"{r['title']} ({r['rating']}★)" if r["rating"] else r["title"] for r in recent) or "nothing yet"
    return f"""You are BookLog's reading assistant. You recommend books from the BookLog catalogue only.

How to answer a request for books:
1. Call search_books (often 2-3 times with different parameters) to gather candidates.
   - "like <book>" -> similar_to_title=<book>; it already skips the same author/series. Also try text=<its themes> and genres.
   - moods/themes -> text + genres. Lengths, years, ratings -> the numeric filters.
   - If results are few or off-target, IMMEDIATELY search again with broader parameters. Never ask the user for permission to search.
2. Pick the 3-8 best matches and call show_books with a one-sentence intro and a short reason per book.
   Only use book_ids that search_books returned. Never invent books.
3. Do not list books in plain text; the cards are the answer.

For follow-ups ("more", "shorter ones", "any older?") use the books already shown (listed in the conversation) and
exclude_book_ids to avoid repeats. Only answer in plain text (no show_books) for greetings or questions that are not book requests.

Genres in the catalogue: {', '.join(_genre_names())}.
The user (@{viewer.username}) likes: {', '.join(favs) or 'unknown'}. Recently logged: {history}."""


def _fallback_reason(row):
    """Used when the model picked a book without saying why."""
    bits = []
    if row.get("categories"):
        bits.append(f"a {row['categories'][0].lower()} match for your request")
    if row.get("average_rating"):
        bits.append(f"rated {float(row['average_rating']):.1f}★ by readers")
    return ("Picked as " + " and ".join(bits) + ".") if bits else "Matched your request in the catalogue."


def _jsonable(row):
    return {k: (v if isinstance(v, (str, int, float, bool, list, type(None))) else str(v)) for k, v in row.items()}


# =====================================================================
# Sessions
# =====================================================================

def list_sessions(viewer):
    try:
        cursor = mongo.get_db().chat_sessions.find(
            {"user_id": viewer.user_id}, {"_id": 1, "title": 1, "updated_at": 1}
        ).sort("updated_at", -1).limit(50)
        return [{"session_id": d["_id"], "title": d.get("title"), "updated_at": d.get("updated_at")} for d in cursor]
    except Exception:
        raise HTTPException(503, "Chat history is unavailable (MongoDB is not running)")


def get_session(viewer, session_id):
    try:
        doc = mongo.get_db().chat_sessions.find_one({"_id": session_id, "user_id": viewer.user_id})
    except Exception:
        raise HTTPException(503, "Chat history is unavailable (MongoDB is not running)")
    if not doc:
        raise HTTPException(404, "Conversation not found")
    return {"session_id": doc["_id"], "title": doc.get("title"), "messages": doc.get("messages", [])}


def delete_session(viewer, session_id):
    mongo.get_db().chat_sessions.delete_one({"_id": session_id, "user_id": viewer.user_id})


def send_message(viewer, content, session_id=None):
    content = (content or "").strip()
    if not content:
        raise HTTPException(400, "Message is empty")
    client = _client()
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    sessions = mongo.get_db().chat_sessions
    if session_id:
        doc = sessions.find_one({"_id": session_id, "user_id": viewer.user_id})
        if not doc:
            raise HTTPException(404, "Conversation not found")
    else:
        doc = {"_id": uuid.uuid4().hex, "user_id": viewer.user_id, "title": content[:60],
               "messages": [], "created_at": mongo.now()}

    messages = [{"role": "system", "content": _system_prompt(viewer)}]
    for m in doc["messages"][-HISTORY_MESSAGES:]:
        text = m["content"]
        if m.get("books"):  # let the model know which cards it already showed
            text += "\n[Books shown: " + "; ".join(f"{b['title']} (book_id {b['book_id']})" for b in m["books"]) + "]"
        messages.append({"role": m["role"], "content": text})
    messages.append({"role": "user", "content": content})

    found = {}  # book_id -> row: everything search_books returned this turn
    reply, picks = None, None
    for _ in range(MAX_TOOL_ROUNDS):
        try:
            resp = client.chat.completions.create(
                model=model, messages=messages, tools=[SEARCH_TOOL, SHOW_TOOL], temperature=0.3,
            )
        except Exception as e:
            raise HTTPException(502, f"The chatbot service failed: {e}")
        msg = resp.choices[0].message
        if not msg.tool_calls:
            reply = msg.content or ""
            break
        messages.append({"role": "assistant", "content": msg.content or "",
                         "tool_calls": [tc.model_dump() for tc in msg.tool_calls]})
        for tc in msg.tool_calls:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}
            if tc.function.name == "show_books":
                # Keep only ids the database actually returned (no invented books)
                picks = [b for b in args.get("books", []) if isinstance(b, dict) and b.get("book_id") in found]
                reply = (args.get("intro") or "").strip()
                result = {"shown": len(picks)}
            else:
                rows = search_books_tool(viewer, args)
                for r in rows:
                    found[r["book_id"]] = r
                result = [{"book_id": r["book_id"], "title": r["title"], "authors": r["authors"], "genres": r["categories"],
                           "rating": r["average_rating"], "pages": r["page_count"], "year": r["pub_year"],
                           "description": r["description"]} for r in rows]
            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})
        if picks:
            break

    if not picks and found and reply is None:
        # Ran out of rounds without choosing: show the best search results
        picks = [{"book_id": b, "reason": None} for b in list(found)[:6]]
    if reply is None:
        reply = "Here are some books from the catalogue that match." if picks else \
            "Sorry, I couldn't find anything for that. Try different words or a genre."
    if not reply and picks:
        reply = "Here are some picks for you."

    seen, cards = set(), []
    for p in picks or []:
        if p["book_id"] in seen:
            continue
        seen.add(p["book_id"])
        row = {k: v for k, v in found[p["book_id"]].items() if k != "description"}
        reason = (p.get("reason") or "").strip() or _fallback_reason(row)
        cards.append(_jsonable({**row, "reason": reason}))

    now = mongo.now()
    doc["messages"] += [
        {"role": "user", "content": content, "ts": now},
        {"role": "assistant", "content": reply, "books": cards, "ts": now},
    ]
    doc["updated_at"] = now
    sessions.replace_one({"_id": doc["_id"]}, doc, upsert=True)
    return {"session_id": doc["_id"], "title": doc["title"], "reply": reply, "books": cards}
