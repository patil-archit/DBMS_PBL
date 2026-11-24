"""Flips feed (one book per screen) and public takes."""
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.deps import Viewer, viewer_optional, viewer_required
from app.services import reels_service

router = APIRouter(tags=["reels"])


class TakeIn(BaseModel):
    book_id: int
    text: str = Field(..., min_length=1, max_length=280)
    vibe: Optional[str] = None


@router.get("/flips")
@router.get("/reels", include_in_schema=False)  # old name, kept so links still work
def flips(
    mode: Literal["for_you", "latest", "following"] = "for_you",
    genre: Optional[str] = None,
    limit: int = Query(8, ge=1, le=20),
    viewer: Optional[Viewer] = Depends(viewer_optional),
):
    return reels_service.feed(viewer, mode, limit, genre)


@router.get("/books/{book_id}/takes")
def takes(book_id: int, viewer: Optional[Viewer] = Depends(viewer_optional)):
    return reels_service.book_takes(book_id, viewer)


@router.post("/takes", status_code=201)
def post_take(body: TakeIn, viewer: Viewer = Depends(viewer_required)):
    return reels_service.post_take(viewer, body.book_id, body.text, body.vibe)


@router.post("/takes/{take_id}/like")
def like_take(take_id: str, viewer: Viewer = Depends(viewer_required)):
    return reels_service.toggle_like(viewer, take_id)


@router.delete("/takes/{take_id}", status_code=204)
def delete_take(take_id: str, viewer: Viewer = Depends(viewer_required)):
    reels_service.delete_take(viewer, take_id)
