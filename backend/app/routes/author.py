from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from app.models.schemas import AuthorDetailResponse
from app.services.neo4j_service import get_author_details, follow_author, unfollow_author, invalidate_search_cache
from app.auth import get_current_user
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth

router = APIRouter()
security = HTTPBearer(auto_error=False)

class FollowRequest(BaseModel):
    author_name: str

def get_optional_uid(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[str]:
    if not credentials:
        return None
    try:
        decoded_token = auth.verify_id_token(credentials.credentials)
        return decoded_token.get("uid")
    except Exception:
        return None

@router.get("/author/{name}", response_model=AuthorDetailResponse)
def get_author(name: str, uid: Optional[str] = Depends(get_optional_uid)):
    author_info = get_author_details(name, user_uid=uid)
    if not author_info:
        raise HTTPException(status_code=404, detail="Author not found in the graph database")
    return author_info

@router.post("/author/follow")
def follow(request: FollowRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user token")
    
    success = follow_author(uid, request.author_name)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to follow author")
        
    # Invalidate cache so that search reflects new follow state immediately
    invalidate_search_cache()
    return {"message": f"Successfully followed {request.author_name}"}

@router.post("/author/unfollow")
def unfollow(request: FollowRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user token")
        
    success = unfollow_author(uid, request.author_name)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to unfollow author")
        
    invalidate_search_cache()
    return {"message": f"Successfully unfollowed {request.author_name}"}
