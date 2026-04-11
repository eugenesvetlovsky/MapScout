from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth import get_current_user
from app.models.models import History, User
from app.schemas.schemas import AddHistoryRequest, HistoryItem, HistoryResponse

router = APIRouter(prefix="/api/history", tags=["history"])


@router.post("/add")
def add_history(
    payload: AddHistoryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    item = History(user_id=current_user.id, place_id=payload.place_id)
    db.add(item)
    db.commit()
    return {"status": "ok"}


@router.get("", response_model=HistoryResponse)
def list_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> HistoryResponse:
    entries = db.scalars(
        select(History).where(History.user_id == current_user.id).order_by(History.visited_at.desc())
    ).all()
    return HistoryResponse(
        history=[HistoryItem(place_id=item.place_id, visited_at=item.visited_at) for item in entries]
    )
