"""Explore, surprise me, book of the day, catalogue stats and reading stats."""
from typing import Literal, Optional

from fastapi import APIRouter, Query

from app.services import discover_service

router = APIRouter(tags=["discover"])


@router.get("/discover/browse")
def browse(
    genre: Optional[str] = None,
    sort: Literal["popular", "rating", "newest", "oldest", "shortest", "longest", "title"] = "popular",
    decade: Optional[int] = Query(None, ge=0, le=2100),
    max_pages: Optional[int] = Query(None, gt=0),
    min_rating: Optional[float] = Query(None, ge=0, le=5),
    offset: int = Query(0, ge=0),
    limit: int = Query(30, ge=1, le=60),
):
    return discover_service.browse(genre, sort, decade, max_pages, min_rating, offset, limit)


@router.get("/discover/genres")
def genres():
    return discover_service.genre_index()


@router.get("/discover/random")
def random_book(genre: Optional[str] = None):
    return discover_service.random_book(genre)


@router.get("/discover/today")
def today():
    return discover_service.book_of_the_day()


@router.get("/discover/stats")
def stats():
    return discover_service.catalogue_stats()


@router.get("/users/{username}/stats")
def reading_stats(username: str, year: Optional[int] = Query(None, ge=1900, le=2100)):
    return discover_service.reading_stats(username, year)


@router.get("/discover/authors")
def featured_authors(limit: int = Query(14, ge=1, le=40)):
    return discover_service.featured_authors(limit)


@router.get("/discover/journal")
def journal(limit: int = Query(6, ge=1, le=24)):
    return discover_service.journal(limit)
