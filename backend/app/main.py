from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import search, books, recommendations, library, author, user
from app.database import db

app = FastAPI(
    title="Book Recommendation API",
    description="Graph-based book recommendation system using Neo4j",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev purposes, allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    db.connect()

@app.on_event("shutdown")
async def shutdown_event():
    db.close()

# Include routers
app.include_router(search.router)
app.include_router(books.router)
app.include_router(recommendations.router)
app.include_router(library.router)
app.include_router(author.router)
app.include_router(user.router)


@app.get("/")
def read_root():
    return {"message": "Welcome to the Book Recommendation API"}
