from pydantic import BaseModel
from typing import List, Optional

class BookBase(BaseModel):
    title: str
    subtitle: Optional[str] = None
    thumbnail: Optional[str] = None
    average_rating: Optional[float] = 0.0

class BookSearchResponse(BookBase):
    authors: List[str] = []
    categories: List[str] = []
    score: Optional[float] = 0.0

class BookDetailResponse(BookSearchResponse):
    description: Optional[str] = None
    published_year: Optional[int] = None
    num_pages: Optional[int] = None
    ratings_count: Optional[int] = None
    isbn13: Optional[str] = None
    isbn10: Optional[str] = None
    in_library: bool = False

class RecommendationResponse(BookBase):
    authors: List[str] = []
    score: float = 0.0

# ---------------------------------------------
# AUTHOR & GENRE SEARCH SCHEMAS
# ---------------------------------------------

class AuthorSearchResponse(BaseModel):
    name: str
    book_count: int = 0
    image_url: Optional[str] = None
    description: Optional[str] = None
    is_followed: bool = False
    score: Optional[float] = 0.0

class GenreSearchResponse(BaseModel):
    name: str
    book_count: int = 0
    score: Optional[float] = 0.0

class UnifiedSearchResponse(BaseModel):
    books: List[BookSearchResponse] = []
    authors: List[AuthorSearchResponse] = []
    genres: List[GenreSearchResponse] = []

# ---------------------------------------------
# GRAPH-BASED AUTHOR PROFILE SCHEMAS
# ---------------------------------------------

class AuthorStats(BaseModel):
    total_books: int = 0
    avg_rating: float = 0.0
    total_ratings: int = 0
    total_pages: int = 0

class CoAuthorInfo(BaseModel):
    name: str
    shared_books: int = 0
    shared_genres: List[str] = []

class AuthorDetailResponse(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    is_followed: bool = False
    stats: AuthorStats
    genres: List[str] = []
    books: List[BookSearchResponse] = []
    co_authors: List[CoAuthorInfo] = []
