from fastapi import APIRouter, HTTPException, Depends
from typing import List
from pydantic import BaseModel
from app.models.schemas import BookSearchResponse, AuthorSearchResponse
from app.services.neo4j_service import add_book_to_library, get_user_library, get_user_followed_authors, get_personalized_recommendations
from app.auth import get_current_user

router = APIRouter()

class AddToLibraryRequest(BaseModel):
    book_title: str

@router.post("/library/add")
def add_to_library(request: AddToLibraryRequest, current_user: dict = Depends(get_current_user)):
    uid = current_user.get("uid")
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid user")
    
    success = add_book_to_library(uid, request.book_title)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to add book to library")
    return {"message": "Book added to library successfully"}

@router.get("/library/{uid}", response_model=List[BookSearchResponse])
def get_library(uid: str, current_user: dict = Depends(get_current_user)):
    token_uid = current_user.get("uid")
    if token_uid != uid:
        raise HTTPException(status_code=403, detail="Not authorized to access this library")
    return get_user_library(uid)

@router.get("/library/{uid}/authors", response_model=List[AuthorSearchResponse])
def get_library_authors(uid: str, current_user: dict = Depends(get_current_user)):
    token_uid = current_user.get("uid")
    if token_uid != uid:
        raise HTTPException(status_code=403, detail="Not authorized to access this library")
    return get_user_followed_authors(uid)

@router.get("/recommendations/user/{uid}", response_model=List[BookSearchResponse])
def get_user_recommendations(uid: str, current_user: dict = Depends(get_current_user)):
    token_uid = current_user.get("uid")
    if token_uid != uid:
        raise HTTPException(status_code=403, detail="Not authorized to access this user")
    return get_personalized_recommendations(uid)
