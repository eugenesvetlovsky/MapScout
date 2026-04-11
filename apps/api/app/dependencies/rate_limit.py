from fastapi import HTTPException, Request, status

from app.core.config import settings
from app.dependencies.redis_client import redis_client


def enforce_rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    key = f"rate_limit:{ip}"
    count = redis_client.incr(key)
    if count == 1:
        redis_client.expire(key, 60)
    if count > settings.rate_limit_per_minute:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded",
        )
