import json
import uuid
from random import uniform

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.dependencies.rate_limit import enforce_rate_limit
from app.dependencies.redis_client import redis_client
from app.models.models import Place
from app.schemas.schemas import NearbyResponse, PlaceCategory, PlaceDetailsResponse, PlaceOut
from app.services.geo import haversine_distance_m

router = APIRouter(prefix="/api/places", tags=["places"])


def _mock_nearby_for_demo(lat: float, lon: float, category: PlaceCategory) -> list[PlaceOut]:
    names: dict[PlaceCategory, list[str]] = {
        "cafe": ["Local Coffee", "Morning Brew", "Bean Corner"],
        "park": ["Green Square", "City Garden", "River Park"],
        "museum": ["City Museum", "Art Space", "History Hall"],
        "restaurant": ["Urban Grill", "Pasta Point", "Bistro Nova"],
        "landmark": ["Old Tower", "Historic Square", "City Gate"],
        "hotel": ["Central Stay", "Skyline Hotel", "Riverfront Suites"],
    }
    items: list[PlaceOut] = []
    for idx, name in enumerate(names[category]):
        point_lat = lat + uniform(-0.008, 0.008)
        point_lon = lon + uniform(-0.008, 0.008)
        distance = haversine_distance_m(lat, lon, point_lat, point_lon)
        items.append(
            PlaceOut(
                id=uuid.uuid5(uuid.NAMESPACE_DNS, f"{category}-{lat}-{lon}-{idx}"),
                name=name,
                category=category,
                description="Demo place near your location",
                photo_url=f"https://picsum.photos/seed/{category}-{idx}/640/360",
                distance=round(distance, 2),
                coordinates={"lat": point_lat, "lon": point_lon},
            )
        )
    return sorted(items, key=lambda place: place.distance)


@router.get("/nearby", response_model=NearbyResponse)
def nearby(
    request: Request,
    lat: float = Query(...),
    lon: float = Query(...),
    category: PlaceCategory = Query(...),
    radius: int = Query(1000),
    db: Session = Depends(get_db),
) -> NearbyResponse:
    enforce_rate_limit(request)
    cache_key = f"nearby:{lat}:{lon}:{category}:{radius}"
    cached = redis_client.get(cache_key)
    if cached:
        return NearbyResponse.model_validate_json(cached)

    places = db.scalars(select(Place).where(Place.category == category)).all()
    output: list[PlaceOut] = []
    for place in places:
        distance = haversine_distance_m(lat, lon, place.lat, place.lon)
        if distance <= radius:
            output.append(
                PlaceOut(
                    id=place.id,
                    name=place.name,
                    category=category,
                    description=place.description,
                    photo_url=f"https://picsum.photos/seed/{place.id}/640/360",
                    distance=round(distance, 2),
                    coordinates={"lat": place.lat, "lon": place.lon},
                )
            )
    if not output:
        output = _mock_nearby_for_demo(lat, lon, category)
    payload = NearbyResponse(places=sorted(output, key=lambda p: p.distance))
    redis_client.setex(cache_key, settings.nearby_cache_ttl_seconds, payload.model_dump_json())
    return payload


@router.get("/{place_id}", response_model=PlaceDetailsResponse)
def get_place(place_id: uuid.UUID, db: Session = Depends(get_db)) -> PlaceDetailsResponse:
    place = db.get(Place, place_id)
    if not place:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found")
    return PlaceDetailsResponse(
        id=place.id,
        name=place.name,
        category=place.category,
        description=place.description,
        photo_url=f"https://picsum.photos/seed/{place.id}/640/360",
        coordinates={"lat": place.lat, "lon": place.lon},
    )
