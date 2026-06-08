from fastapi import APIRouter
from typing import List
from app.models.schemas import RecommendationResponse
from app.services.neo4j_service import get_recommendations

router = APIRouter()

@router.get("/recommendations/{title}", response_model=List[RecommendationResponse])
def recommend(title: str):
    recommendations = get_recommendations(title)
    return recommendations
