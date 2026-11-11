"""Books, search, genres, authors, trending, recommendations."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app import mongo
from app.deps import Viewer, viewer_optional, viewer_required
from app.services import book_service, diary_service

router = APIRouter(tags=["catalogue"])


@router.get("/search")
def search(
    q: str = Query("", description="Title, author, genre or ISBN (typos allowed)"),
    genre: Optional[str] = None,
    language: Optional[str] = None,
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    viewer: Optional[Viewer] = Depends(viewer_optional),
):
    return book_service.search_all(q, viewer, genre=genre, language=language, min_rating=min_rating)


@router.get("/genres")
def genres():
    return book_service.list_genres()


@router.get("/languages")
def languages():
    return book_service.list_languages()


@router.get("/books")
def all_books():
    return book_service.get_all_books()


@router.get("/books/stats")
def stats():
    return book_service.get_db_stats()


@router.get("/books/trending")
def trending(limit: int = Query(12, le=50)):
    return book_service.get_trending(limit)


@router.get("/book/{title}")
def book(title: str, viewer: Optional[Viewer] = Depends(viewer_optional)):
    found = book_service.get_book_details(title, viewer)
    if not found:
        raise HTTPException(404, "Book not found")
    return found


@router.get("/book/{title}/similar")
def similar(title: str, viewer: Optional[Viewer] = Depends(viewer_optional)):
    return book_service.get_similar_books(title)


@router.get("/books/{book_id}/reviews")
def reviews(book_id: int, viewer: Optional[Viewer] = Depends(viewer_optional)):
    return diary_service.get_book_reviews(book_id)


@router.get("/recommendations")
def recommendations(refresh: bool = False, viewer: Viewer = Depends(viewer_required)):
    return book_service.get_recommendations_for(viewer, use_cache=not refresh)


# ---------------------------------------------------------------------
# Authors
# ---------------------------------------------------------------------
class AuthorFollow(BaseModel):
    author_name: str


@router.get("/author/{name}")
def author(name: str, viewer: Optional[Viewer] = Depends(viewer_optional)):
    found = book_service.get_author_details(name)
    if not found:
        raise HTTPException(404, "Author not found")
    return found


@router.post("/author/follow")
def follow_author(body: AuthorFollow, viewer: Viewer = Depends(viewer_required)):
    if not book_service.follow_author(viewer, body.author_name):
        raise HTTPException(404, "Author not found")
    return {"ok": True}


@router.post("/author/unfollow")
def unfollow_author(body: AuthorFollow, viewer: Viewer = Depends(viewer_required)):
    book_service.unfollow_author(viewer, body.author_name)
    return {"ok": True}


# ---------------------------------------------------------------------
# Activity logging (MongoDB)
# ---------------------------------------------------------------------
class Click(BaseModel):
    book_id: int
    source: Optional[str] = None


@router.post("/activity/click")
def click(body: Click, viewer: Optional[Viewer] = Depends(viewer_optional)):
    mongo.log_activity("click", user_id=viewer.user_id if viewer else None, book_id=body.book_id, source=body.source)
    return {"ok": True}
