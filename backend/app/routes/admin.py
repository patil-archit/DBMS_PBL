"""Admin and moderator endpoints."""
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app import sync_worker
from app.deps import Viewer, admin_required, moderator_required
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])


class BookIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    subtitle: Optional[str] = None
    isbn: Optional[str] = Field(None, max_length=13)
    language: Optional[str] = Field("en", max_length=10)
    description: Optional[str] = None
    pub_year: Optional[int] = Field(None, ge=0, le=2100)
    page_count: Optional[int] = Field(None, gt=0)
    cover_url: Optional[str] = None
    publisher: Optional[str] = None
    authors: Optional[List[str]] = None
    genres: Optional[List[str]] = None


class AuthorIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    bio: Optional[str] = None
    photo_url: Optional[str] = None


class GenreIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    parent_genre_id: Optional[int] = None


class Resolve(BaseModel):
    action: Literal["dismiss", "remove"]


class RoleIn(BaseModel):
    role: Literal["reader", "moderator", "admin"]


# --- catalogue (admin) ------------------------------------------------
@router.get("/books")
def books(q: str = "", viewer: Viewer = Depends(admin_required)):
    return admin_service.list_books_admin(q)


@router.get("/books/{book_id}")
def book(book_id: int, viewer: Viewer = Depends(admin_required)):
    return admin_service.get_book_admin(book_id)


@router.post("/books")
def create_book(body: BookIn, viewer: Viewer = Depends(admin_required)):
    return admin_service.save_book(body.model_dump())


@router.put("/books/{book_id}")
def update_book(book_id: int, body: BookIn, viewer: Viewer = Depends(admin_required)):
    return admin_service.save_book(body.model_dump(), book_id)


@router.delete("/books/{book_id}")
def delete_book(book_id: int, viewer: Viewer = Depends(admin_required)):
    admin_service.delete_book(book_id)
    return {"ok": True}


@router.get("/authors")
def authors(q: str = "", viewer: Viewer = Depends(admin_required)):
    return admin_service.list_authors_admin(q)


@router.post("/authors")
def create_author(body: AuthorIn, viewer: Viewer = Depends(admin_required)):
    return admin_service.save_author(body.model_dump())


@router.put("/authors/{author_id}")
def update_author(author_id: int, body: AuthorIn, viewer: Viewer = Depends(admin_required)):
    return admin_service.save_author(body.model_dump(), author_id)


@router.delete("/authors/{author_id}")
def delete_author(author_id: int, viewer: Viewer = Depends(admin_required)):
    admin_service.delete_author(author_id)
    return {"ok": True}


@router.get("/genres")
def genres(viewer: Viewer = Depends(admin_required)):
    return admin_service.list_genres_admin()


@router.post("/genres")
def create_genre(body: GenreIn, viewer: Viewer = Depends(admin_required)):
    return admin_service.save_genre(body.model_dump())


@router.put("/genres/{genre_id}")
def update_genre(genre_id: int, body: GenreIn, viewer: Viewer = Depends(admin_required)):
    return admin_service.save_genre(body.model_dump(), genre_id)


@router.delete("/genres/{genre_id}")
def delete_genre(genre_id: int, viewer: Viewer = Depends(admin_required)):
    admin_service.delete_genre(genre_id)
    return {"ok": True}


# --- moderation (moderators + admins) -----------------------------------
@router.get("/reports")
def reports(status: Literal["open", "dismissed", "removed"] = "open", viewer: Viewer = Depends(moderator_required)):
    return admin_service.list_reports(status)


@router.post("/reports/{report_id}/resolve")
def resolve(report_id: int, body: Resolve, viewer: Viewer = Depends(moderator_required)):
    admin_service.resolve_report(viewer, report_id, body.action)
    return {"ok": True}


# --- reports, audit, users (admin) ---------------------------------------
@router.get("/analytics")
def analytics(refresh: bool = True, viewer: Viewer = Depends(admin_required)):
    return admin_service.analytics(refresh)


@router.get("/audit")
def audit(table: Optional[str] = None, limit: int = 100, viewer: Viewer = Depends(admin_required)):
    return admin_service.audit_log(min(limit, 500), table)


@router.get("/users")
def users(q: str = "", viewer: Viewer = Depends(admin_required)):
    return admin_service.list_users(q)


@router.put("/users/{user_id}/role")
def set_role(user_id: int, body: RoleIn, viewer: Viewer = Depends(admin_required)):
    return admin_service.set_role(viewer, user_id, body.role)


@router.post("/sync/run")
def run_sync(viewer: Viewer = Depends(admin_required)):
    return {"applied": sync_worker.process_once(), "status": sync_worker.status()}
