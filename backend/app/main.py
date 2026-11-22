from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from app import graph, mongo, sync_worker  # noqa: E402
from app.database import db  # noqa: E402
from app.deps import viewer_optional  # noqa: E402
from app.routes import admin, catalog, chat, diary, discover, lists, reels, social, users  # noqa: E402

app = FastAPI(
    title="BookLog API",
    description="BookLog: a social book diary and recommendation system "
                "(PostgreSQL + Neo4j + MongoDB)",
    version="2.0.0",
    # every request identifies the viewer so PostgreSQL row-level security applies
    dependencies=[Depends(viewer_optional)],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    db.connect()
    mongo.ensure_indexes()
    graph.ensure_constraints()
    sync_worker.start()


@app.on_event("shutdown")
def shutdown_event():
    sync_worker.stop()
    db.close()


for r in (catalog, discover, diary, lists, users, admin, chat, reels, social):
    app.include_router(r.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to the BookLog API"}


@app.get("/health")
def health():
    status = {"postgres": False, "neo4j": False, "mongodb": False}
    try:
        with db.cursor(system=True) as cur:
            cur.execute("SELECT 1")
        status["postgres"] = True
    except Exception:
        pass
    try:
        graph.run("RETURN 1")
        status["neo4j"] = True
    except graph.GraphUnavailable:
        pass
    try:
        mongo.get_db().command("ping")
        status["mongodb"] = True
    except Exception:
        pass
    return status
