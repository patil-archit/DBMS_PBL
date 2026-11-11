"""Diary entries, shelves, reading goals, review likes / comments / reports."""
from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.deps import Viewer, viewer_optional, viewer_required
from app.services import diary_service

router = APIRouter(tags=["diary"])

Rating = Optional[float]


class EntryIn(BaseModel):
    book_id: int
    rating: Rating = Field(None, ge=0.5, le=5, multiple_of=0.5)
    review_text: Optional[str] = Field(None, max_length=10000)
    date_read: Optional[date] = None
    is_liked: bool = False


class EntryPatch(BaseModel):
    rating: Rating = Field(None, ge=0.5, le=5, multiple_of=0.5)
    review_text: Optional[str] = Field(None, max_length=10000)
    date_read: Optional[date] = None
    is_liked: Optional[bool] = None


@router.post("/diary")
def log_book(body: EntryIn, viewer: Viewer = Depends(viewer_required)):
    return diary_service.log_book(viewer, body.book_id, body.rating, body.review_text, body.date_read, body.is_liked)


@router.patch("/diary/{entry_id}")
def edit_entry(entry_id: int, body: EntryPatch, viewer: Viewer = Depends(viewer_required)):
    # exclude_unset lets the client clear a rating by sending null explicitly
    return diary_service.update_entry(viewer, entry_id, body.model_dump(exclude_unset=True))


@router.delete("/diary/{entry_id}")
def delete_entry(entry_id: int, viewer: Viewer = Depends(viewer_required)):
    diary_service.delete_entry(viewer, entry_id)
    return {"ok": True}


# ---------------------------------------------------------------------
# Shelves
# ---------------------------------------------------------------------
class ShelfIn(BaseModel):
    status: Literal["want_to_read", "currently_reading"]


@router.put("/shelves/{book_id}")
def set_shelf(book_id: int, body: ShelfIn, viewer: Viewer = Depends(viewer_required)):
    diary_service.set_shelf(viewer, book_id, body.status)
    return {"ok": True, "status": body.status}


@router.delete("/shelves/{book_id}")
def remove_shelf(book_id: int, viewer: Viewer = Depends(viewer_required)):
    diary_service.remove_shelf(viewer, book_id)
    return {"ok": True}


# ---------------------------------------------------------------------
# Reading goal
# ---------------------------------------------------------------------
class GoalIn(BaseModel):
    year: int = Field(..., ge=1900, le=2100)
    target_books: int = Field(..., ge=1, le=1000)


@router.get("/me/goal")
def get_goal(year: Optional[int] = None, viewer: Viewer = Depends(viewer_required)):
    return diary_service.get_goal(viewer.user_id, year or date.today().year)


@router.put("/me/goal")
def set_goal(body: GoalIn, viewer: Viewer = Depends(viewer_required)):
    return diary_service.set_goal(viewer, body.year, body.target_books)


@router.delete("/me/goal/{year}")
def delete_goal(year: int, viewer: Viewer = Depends(viewer_required)):
    diary_service.delete_goal(viewer, year)
    return {"ok": True}


# ---------------------------------------------------------------------
# Reviews: likes, comments, reports
# ---------------------------------------------------------------------
class CommentIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


class ReportIn(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


@router.post("/reviews/{entry_id}/like")
def like_review(entry_id: int, viewer: Viewer = Depends(viewer_required)):
    return diary_service.toggle_review_like(viewer, entry_id)


@router.get("/reviews/{entry_id}/comments")
def review_comments(entry_id: int, viewer: Optional[Viewer] = Depends(viewer_optional)):
    return diary_service.get_comments(entry_id=entry_id)


@router.post("/reviews/{entry_id}/comments")
def comment_review(entry_id: int, body: CommentIn, viewer: Viewer = Depends(viewer_required)):
    return diary_service.add_comment(viewer, body.text, entry_id=entry_id)


@router.post("/reviews/{entry_id}/report")
def report_review(entry_id: int, body: ReportIn, viewer: Viewer = Depends(viewer_required)):
    diary_service.report_review(viewer, entry_id, body.reason)
    return {"ok": True}


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, viewer: Viewer = Depends(viewer_required)):
    diary_service.delete_comment(viewer, comment_id)
    return {"ok": True}
