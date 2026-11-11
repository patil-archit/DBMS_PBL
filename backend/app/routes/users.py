"""Account, profiles, following, feed, social graph."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.deps import Viewer, viewer_optional, viewer_required
from app.services import book_service, diary_service, list_service, user_service

router = APIRouter(tags=["users"])


class MePatch(BaseModel):
    username: Optional[str] = Field(None, max_length=30)
    bio: Optional[str] = Field(None, max_length=1000)
    language: Optional[str] = Field(None, max_length=10)
    is_private: Optional[bool] = None


class Genres(BaseModel):
    genres: List[str]


# ---------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------
@router.get("/me")
def me(viewer: Viewer = Depends(viewer_required)):
    return user_service.get_me(viewer)


@router.patch("/me")
def update_me(body: MePatch, viewer: Viewer = Depends(viewer_required)):
    return user_service.update_me(viewer, body.model_dump())


@router.put("/me/genres")
def set_genres(body: Genres, viewer: Viewer = Depends(viewer_required)):
    return user_service.set_favourite_genres(viewer, body.genres)


@router.delete("/me")
def delete_me(viewer: Viewer = Depends(viewer_required)):
    user_service.delete_account(viewer)
    return {"ok": True}


@router.get("/me/export")
def export(viewer: Viewer = Depends(viewer_required)):
    return user_service.export_data(viewer)


@router.get("/me/followed-authors")
def followed_authors(viewer: Viewer = Depends(viewer_required)):
    return book_service.get_followed_authors(viewer.user_id)


@router.get("/feed")
def feed(viewer: Viewer = Depends(viewer_required)):
    return user_service.get_feed(viewer)


@router.get("/people/suggestions")
def suggestions(viewer: Viewer = Depends(viewer_required)):
    return user_service.suggestions(viewer)


@router.get("/people/search")
def search_people(q: str = Query(..., min_length=1), viewer: Optional[Viewer] = Depends(viewer_optional)):
    return user_service.search_users(q)


# ---------------------------------------------------------------------
# Profiles
# ---------------------------------------------------------------------
@router.get("/users/{username}")
def profile(username: str, viewer: Optional[Viewer] = Depends(viewer_optional)):
    return user_service.get_profile(username, viewer)


@router.get("/users/{username}/diary")
def diary(username: str, year: Optional[int] = None, viewer: Optional[Viewer] = Depends(viewer_optional)):
    p = user_service.get_profile(username, viewer)
    return diary_service.get_diary(p["user_id"], year)  # RLS returns [] for private diaries


@router.get("/users/{username}/shelves")
def shelves(username: str, viewer: Optional[Viewer] = Depends(viewer_optional)):
    p = user_service.get_profile(username, viewer)
    return diary_service.get_shelves(p["user_id"], viewer.user_id if viewer else None)


@router.get("/users/{username}/lists")
def lists(username: str, viewer: Optional[Viewer] = Depends(viewer_optional)):
    p = user_service.get_profile(username, viewer)
    return list_service.user_lists(p["user_id"])


@router.get("/users/{username}/goal")
def goal(username: str, year: Optional[int] = None, viewer: Optional[Viewer] = Depends(viewer_optional)):
    from datetime import date
    p = user_service.get_profile(username, viewer)
    if p["diary_hidden"]:
        return None
    return diary_service.get_goal(p["user_id"], year or date.today().year)


@router.get("/users/{username}/followers")
def followers(username: str, viewer: Optional[Viewer] = Depends(viewer_optional)):
    return user_service.follow_list(username, "followers")


@router.get("/users/{username}/following")
def following(username: str, viewer: Optional[Viewer] = Depends(viewer_optional)):
    return user_service.follow_list(username, "following")


@router.post("/users/{username}/follow")
def follow(username: str, viewer: Viewer = Depends(viewer_required)):
    user_service.follow(viewer, username)
    return {"ok": True}


@router.delete("/users/{username}/follow")
def unfollow(username: str, viewer: Viewer = Depends(viewer_required)):
    user_service.unfollow(viewer, username)
    return {"ok": True}
