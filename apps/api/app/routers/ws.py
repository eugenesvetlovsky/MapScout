import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.models import Place
from app.services.geo import haversine_distance_m

router = APIRouter(tags=["ws"])


@router.websocket("/ws/location")
async def ws_location(websocket: WebSocket):
    await websocket.accept()
    db: Session = SessionLocal()
    try:
        while True:
            message = await websocket.receive_text()
            data = json.loads(message)
            lat = float(data.get("lat"))
            lon = float(data.get("lon"))
            places = db.scalars(select(Place)).all()
            result: list[dict[str, Any]] = []
            for place in places:
                result.append(
                    {
                        "id": str(place.id),
                        "distance": round(haversine_distance_m(lat, lon, place.lat, place.lon), 2),
                    }
                )
            await websocket.send_json({"distances": result})
    except WebSocketDisconnect:
        return
    finally:
        db.close()
