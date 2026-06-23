from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from app.auth import get_current_user
from app.services.neo4j_service import (
    get_user_profile,
    follow_user,
    unfollow_user,
    get_user_friends,
    get_friends_activity,
    get_connection_degree,
    get_friend_suggestions,
    compare_libraries
)
from app.models.schemas import BookSearchResponse, FriendActivityResponse

router = APIRouter(prefix="/api/user", tags=["user"])

class FollowRequest(BaseModel):
    friend_code: str

@router.get("/profile")
def get_profile(current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    name = current_user.get("name", "Unknown User")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user")
    
    profile = get_user_profile(uid, name)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    return profile

@router.post("/follow")
def follow(request: FollowRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user")
    
    success = follow_user(uid, request.friend_code)
    if not success:
        raise HTTPException(status_code=404, detail="User not found or already followed")
    
    return {"message": "Successfully followed user"}

@router.post("/unfollow")
def unfollow(request: FollowRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user")
    
    success = unfollow_user(uid, request.friend_code)
    if not success:
        raise HTTPException(status_code=404, detail="Follow relationship not found")
    
    return {"message": "Successfully unfollowed user"}

@router.get("/friends")
def get_friends(current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user")
    
    return get_user_friends(uid)

@router.get("/friends/activity", response_model=List[FriendActivityResponse])
def get_activity(current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user")
    
    return get_friends_activity(uid)

@router.get("/connection/{target_friend_code}")
def get_connection(target_friend_code: str, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user")
    
    degree = get_connection_degree(uid, target_friend_code)
    return {"degree": degree}

@router.get("/suggestions")
def get_suggestions(current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user")
    
    return get_friend_suggestions(uid)

@router.get("/compare/{target_friend_code}")
def compare_with_friend(target_friend_code: str, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user")
    
    result = compare_libraries(uid, target_friend_code)
    if not result:
        raise HTTPException(status_code=404, detail="Could not compare libraries")
    
    return result
