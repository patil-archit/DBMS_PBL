"""Messages, notifications, presence and reading-now."""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.deps import Viewer, viewer_optional, viewer_required
from app.services import social_service as s

router = APIRouter(tags=["social"])


class MessageIn(BaseModel):
    text: Optional[str] = Field(None, max_length=1000)
    book_id: Optional[int] = None


@router.get("/me/pulse")
def pulse(viewer: Viewer = Depends(viewer_required)):
    return s.pulse(viewer)


@router.get("/messages")
def threads(viewer: Viewer = Depends(viewer_required)):
    return s.threads(viewer)


@router.get("/messages/contacts")
def contacts(viewer: Viewer = Depends(viewer_required)):
    return s.contacts(viewer)


@router.get("/messages/{username}")
def conversation(username: str, viewer: Viewer = Depends(viewer_required)):
    return s.conversation(viewer, username)


@router.post("/messages/{username}", status_code=201)
def send(username: str, body: MessageIn, viewer: Viewer = Depends(viewer_required)):
    return s.send(viewer, username, body.text, body.book_id)


@router.post("/messages/{username}/read")
def read(username: str, viewer: Viewer = Depends(viewer_required)):
    return s.mark_read(viewer, username)


@router.get("/notifications")
def notifications(viewer: Viewer = Depends(viewer_required)):
    return s.notifications(viewer)


@router.post("/notifications/seen", status_code=204)
def notifications_seen(viewer: Viewer = Depends(viewer_required)):
    s.mark_notifications_seen(viewer)


@router.get("/people/reading-now")
def reading_now(viewer: Viewer = Depends(viewer_required)):
    return s.reading_now(viewer)


@router.get("/books/{book_id}/readers-now")
def readers_now(book_id: int, viewer: Optional[Viewer] = Depends(viewer_optional)):
    return s.readers_now(book_id, viewer)
