from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import Base, SessionLocal, engine
from app.models.models import Place
from app.routers import auth, history, places, ws

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth.router)
app.include_router(places.router)
app.include_router(history.router)
app.include_router(ws.router)


def seed_places() -> None:
    db = SessionLocal()
    try:
        if db.query(Place).count() > 0:
            return
        db.add_all(
            [
                Place(
                    name="Coffee House",
                    category="cafe",
                    lat=55.7522,
                    lon=37.6156,
                    description="Small cozy cafe",
                ),
                Place(
                    name="Central Park",
                    category="park",
                    lat=55.7601,
                    lon=37.6189,
                    description="Green city park",
                ),
                Place(
                    name="City Museum",
                    category="museum",
                    lat=55.7481,
                    lon=37.6045,
                    description="Local history museum",
                ),
                Place(
                    name="Urban Grill",
                    category="restaurant",
                    lat=55.7542,
                    lon=37.6211,
                    description="Modern restaurant with local cuisine",
                ),
                Place(
                    name="Old Tower",
                    category="landmark",
                    lat=55.7462,
                    lon=37.6112,
                    description="Historic city landmark",
                ),
                Place(
                    name="Central Stay",
                    category="hotel",
                    lat=55.7588,
                    lon=37.6141,
                    description="Business-friendly hotel in city center",
                ),
            ]
        )
        db.commit()
    finally:
        db.close()


seed_places()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
