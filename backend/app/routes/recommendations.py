from fastapi import APIRouter
from typing import List, Optional
from app.models.schemas import RecommendationResponse
from app.services.neo4j_service import get_recommendations

router = APIRouter()

@router.get("/recommendations/{title}", response_model=List[RecommendationResponse])
def recommend(title: str, uid: Optional[str] = None):
    recommendations = get_recommendations(title, uid)
    return recommendations
