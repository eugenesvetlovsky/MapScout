import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr

PlaceCategory = Literal["cafe", "park", "museum", "restaurant", "landmark", "hotel"]


class Coordinates(BaseModel):
    lat: float
    lon: float


class PlaceOut(BaseModel):
    id: uuid.UUID
    name: str
    category: PlaceCategory
    description: str
    photo_url: str | None = None
    distance: float
    coordinates: Coordinates


class NearbyResponse(BaseModel):
    places: list[PlaceOut]


class PlaceDetailsResponse(BaseModel):
    id: uuid.UUID
    name: str
    category: PlaceCategory
    description: str
    photo_url: str | None = None
    coordinates: Coordinates


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class AddHistoryRequest(BaseModel):
    place_id: uuid.UUID


class HistoryItem(BaseModel):
    place_id: uuid.UUID
    visited_at: datetime


class HistoryResponse(BaseModel):
    history: list[HistoryItem]
