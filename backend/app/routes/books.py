from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.models.schemas import BookDetailResponse, BookSearchResponse
from app.services.neo4j_service import get_book_details, get_all_books, get_db_stats

router = APIRouter()

@router.get("/books", response_model=List[BookSearchResponse])
def get_books():
    return get_all_books()

@router.get("/books/stats")
def get_stats():
    return get_db_stats()

@router.get("/book/{title}", response_model=BookDetailResponse)
def get_book(title: str, uid: Optional[str] = None):
    book = get_book_details(title, uid)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

