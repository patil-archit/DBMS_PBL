from fastapi import APIRouter, Query, Depends
from typing import Optional
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.models.schemas import UnifiedSearchResponse
from app.services.neo4j_service import get_all_searchable_nodes
from app.search.bmh_search import AdvancedBMHSearch
from app.database import db
from firebase_admin import auth

router = APIRouter()
security = HTTPBearer(auto_error=False)

def get_optional_uid(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[str]:
    if not credentials:
        return None
    try:
        decoded_token = auth.verify_id_token(credentials.credentials)
        return decoded_token.get("uid")
    except Exception:
        return None

@router.get("/search", response_model=UnifiedSearchResponse)
def search(
    q: str = Query(..., description="Advanced multi-token Boyer-Moore-Horspool search"),
    uid: Optional[str] = Depends(get_optional_uid)
):
    # 1. Fetch all searchable nodes (uses in-memory cache with 5m TTL)
    nodes = get_all_searchable_nodes()
    
    # 2. Run the Advanced Boyer-Moore-Horspool search
    results = AdvancedBMHSearch.search_entities(
        query=q,
        books=nodes["books"],
        authors=nodes["authors"],
        categories=nodes["categories"]
    )
    
    # 3. If user is logged in, check which authors they follow in the graph
    if uid and results["authors"]:
        author_names = [a["name"] for a in results["authors"]]
        query_follows = """
        MATCH (u:User {uid: $uid})-[r:FOLLOWS]->(a:Author)
        WHERE a.name IN $names
        RETURN a.name AS name
        """
        with db.get_session() as session:
            res = session.run(query_follows, parameters={"uid": uid, "names": author_names})
            followed_set = {record["name"] for record in res}
            
        for author in results["authors"]:
            author["is_followed"] = author["name"] in followed_set

    return results

@router.get("/simulate")
def simulate(
    node: str = Query(..., description="The starting node name (book, author, or genre)"),
    algo: str = Query("bfs", description="The algorithm to use (bfs or dfs)"),
    limit: Optional[int] = Query(None, description="The maximum number of nodes to traverse")
):
    from app.services.neo4j_service import simulate_graph_traversal
    return simulate_graph_traversal(node, algo, limit)
