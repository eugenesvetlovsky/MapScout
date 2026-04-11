# MapScout

Geolocation guide for nearby places. The project is implemented as a monorepo with a React + TypeScript frontend and a FastAPI backend.

## Monorepo structure

- `apps/web` - React + TypeScript + Leaflet UI.
- `apps/api` - FastAPI + PostgreSQL + Redis API.
- `packages/shared-types` - shared TypeScript contracts and utility types examples.
- `infra` - local infrastructure (`docker-compose`).

## Why monorepo and not microservices now

For MVP, this repository uses a modular monolith backend (single deployable API) with clear layers (`routers/services/repositories/models/schemas`). It keeps complexity low and lets you split into microservices later (auth, places, history) without rewriting contracts.

## Implemented MVP scope

- Geolocation and current user marker.
- Nearby places on map with category filter (`cafe`, `park`, `museum`).
- Marker clustering for large marker sets.
- Place popup with name/category/distance.
- JWT auth (`register`, `login`, `refresh`) with protected history endpoints.
- Redis cache for nearby search (TTL 30 sec).
- Redis rate limit (60 req/min/IP).
- WebSocket endpoint for live distance updates.

## Security notes

- JWT access/refresh token flow is implemented.
- SQL injection is mitigated by SQLAlchemy ORM and parameterized queries.
- CORS middleware is enabled for local dev.
- OAuth2 Google is left for next iteration (roadmap).

## TypeScript requirements covered

In `packages/shared-types/src/index.ts`:
- Utility types: `Pick`, `Omit`, `Partial`, `Required`, `Record`, `ReturnType`, `Awaited`.
- Conditional types.
- Mapped types.
- Template literal types.

In `apps/web/src/asyncExamples.ts`:
- `Promise.all`, `Promise.allSettled`, `Promise.race`.
- `for await...of` example.

## Caching strategy

- API: Redis cache for `/api/places/nearby`.
- Browser: React Query request cache.
- CDN: recommended for static assets in production deployment.
- Invalidation: TTL-based for nearby results; token rotation for refresh tokens.

## Local run with Docker

```bash
cd infra
docker compose up --build
```

- Web: `http://localhost:5173`
- API: `http://localhost:8000`

## Local run without Docker

```bash
# Root
pnpm install

# API
cd apps/api
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Web (new terminal)
cd apps/web
pnpm dev
```

## GitFlow naming (baseline)

- Features: `feature/map-nearby-filter`
- Fixes: `fix/jwt-refresh-validation`
- Chores: `chore/infra-compose`

## How to undo a commit

- Keep changes staged: `git reset --soft HEAD~1`
- Keep changes unstaged: `git reset --mixed HEAD~1`
- Drop local commit and changes: `git reset --hard HEAD~1` (use carefully)

## Roadmap

- OAuth2 Google login.
- Route building integration (OSRM).
- History UI improvements and reviews/ratings.
- Audio guide mode.
- MongoDB read model and Socket.io realtime channel.
