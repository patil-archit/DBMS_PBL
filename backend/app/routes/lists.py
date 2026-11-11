"""Ranked book lists."""
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.deps import Viewer, viewer_optional, viewer_required
from app.services import diary_service, list_service

router = APIRouter(prefix="/lists", tags=["lists"])


class ListIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    is_public: bool = True
    book_ids: List[int] = []


class ListPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    is_public: Optional[bool] = None


class BookRef(BaseModel):
    book_id: int


class Order(BaseModel):
    book_ids: List[int]


class CommentIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


@router.get("")
def browse(sort: Literal["popular", "recent"] = "popular", viewer: Optional[Viewer] = Depends(viewer_optional)):
    return list_service.browse_lists(sort)


@router.get("/mine")
def mine(book_id: Optional[int] = None, viewer: Viewer = Depends(viewer_required)):
    return list_service.user_lists(viewer.user_id, book_id)


@router.post("")
def create(body: ListIn, viewer: Viewer = Depends(viewer_required)):
    return list_service.create_list(viewer, body.name, body.description, body.is_public, body.book_ids)


@router.get("/{list_id}")
def get(list_id: int, viewer: Optional[Viewer] = Depends(viewer_optional)):
    return list_service.get_list(list_id)


@router.patch("/{list_id}")
def update(list_id: int, body: ListPatch, viewer: Viewer = Depends(viewer_required)):
    return list_service.update_list(viewer, list_id, body.model_dump())


@router.delete("/{list_id}")
def delete(list_id: int, viewer: Viewer = Depends(viewer_required)):
    list_service.delete_list(viewer, list_id)
    return {"ok": True}


@router.post("/{list_id}/books")
def add_book(list_id: int, body: BookRef, viewer: Viewer = Depends(viewer_required)):
    return list_service.add_book(viewer, list_id, body.book_id)


@router.delete("/{list_id}/books/{book_id}")
def remove_book(list_id: int, book_id: int, viewer: Viewer = Depends(viewer_required)):
    return list_service.remove_book(viewer, list_id, book_id)


@router.put("/{list_id}/order")
def reorder(list_id: int, body: Order, viewer: Viewer = Depends(viewer_required)):
    return list_service.reorder(viewer, list_id, body.book_ids)


@router.post("/{list_id}/like")
def like(list_id: int, viewer: Viewer = Depends(viewer_required)):
    return list_service.toggle_like(viewer, list_id)


@router.get("/{list_id}/comments")
def comments(list_id: int, viewer: Optional[Viewer] = Depends(viewer_optional)):
    return diary_service.get_comments(list_id=list_id)


@router.post("/{list_id}/comments")
def comment(list_id: int, body: CommentIn, viewer: Viewer = Depends(viewer_required)):
    return diary_service.add_comment(viewer, body.text, list_id=list_id)
