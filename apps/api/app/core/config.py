from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "MapScout API"
    debug: bool = True

    database_url: str = "postgresql+psycopg://postgres:postgres@postgres:5432/mapscout"
    redis_url: str = "redis://redis:6379/0"

    jwt_secret: str = "dev_secret_change_me"
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 30
    refresh_token_exp_days: int = 7

    rate_limit_per_minute: int = 60
    nearby_cache_ttl_seconds: int = 30

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
