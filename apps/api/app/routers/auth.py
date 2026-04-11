import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.redis_client import redis_client
from app.models.models import User
from app.schemas.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenPairResponse
from app.services.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenPairResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenPairResponse:
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already used")
    user = User(email=payload.email, name=payload.name, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    redis_client.setex(f"refresh:{user.id}:{refresh}", 60 * 60 * 24 * 7, "1")
    return TokenPairResponse(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenPairResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenPairResponse:
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access = create_access_token(str(user.id))
    refresh = create_refresh_token(str(user.id))
    redis_client.setex(f"refresh:{user.id}:{refresh}", 60 * 60 * 24 * 7, "1")
    return TokenPairResponse(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenPairResponse)
def refresh(payload: RefreshRequest) -> TokenPairResponse:
    token_payload = decode_token(payload.refresh_token)
    if token_payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    user_id = token_payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token subject missing")
    key = f"refresh:{user_id}:{payload.refresh_token}"
    if not redis_client.exists(key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")
    access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)
    redis_client.delete(key)
    redis_client.setex(f"refresh:{user_id}:{new_refresh}", 60 * 60 * 24 * 7, "1")
    return TokenPairResponse(access_token=access, refresh_token=new_refresh)
