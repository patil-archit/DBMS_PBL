"""Chatbot conversations (history stored in MongoDB)."""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.deps import Viewer, viewer_required
from app.services import chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


class MessageIn(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None


@router.get("/sessions")
def sessions(viewer: Viewer = Depends(viewer_required)):
    return chat_service.list_sessions(viewer)


@router.get("/sessions/{session_id}")
def session(session_id: str, viewer: Viewer = Depends(viewer_required)):
    return chat_service.get_session(viewer, session_id)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, viewer: Viewer = Depends(viewer_required)):
    chat_service.delete_session(viewer, session_id)
    return {"ok": True}


@router.post("/messages")
def send(body: MessageIn, viewer: Viewer = Depends(viewer_required)):
    return chat_service.send_message(viewer, body.content, body.session_id)
