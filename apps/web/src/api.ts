import type {
  NearbyFetcherResult,
  Place,
  PlaceCategory,
  PlaceDetails,
} from '@mapscout/shared-types';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

type PlaceApi = Omit<Place, 'photoUrl'> & { photo_url?: string };
const API_CATEGORIES: PlaceCategory[] = [
  'cafe',
  'park',
  'museum',
  'restaurant',
  'landmark',
  'hotel',
];

function normalizePlace(place: PlaceApi): Place {
  return {
    ...place,
    photoUrl: place.photo_url,
  };
}

export async function fetchNearby(
  lat: number,
  lon: number,
  category: PlaceCategory | 'all',
  signal?: AbortSignal,
): Promise<NearbyFetcherResult> {
  if (category === 'all') {
    const responses = await Promise.all(
      API_CATEGORIES.map((item) =>
        request<{ places: PlaceApi[] }>(
          `/api/places/nearby?lat=${lat}&lon=${lon}&category=${item}&radius=3000`,
          signal,
        ),
      ),
    );
    const byId = new Map<string, Place>();
    for (const response of responses) {
      for (const place of response.places.map(normalizePlace)) {
        if (!byId.has(place.id)) {
          byId.set(place.id, place);
        }
      }
    }
    return { places: [...byId.values()].sort((a, b) => a.distance - b.distance) };
  }

  const response = await request<{ places: PlaceApi[] }>(
    `/api/places/nearby?lat=${lat}&lon=${lon}&category=${category}&radius=3000`,
    signal,
  );
  return { places: response.places.map(normalizePlace) };
}

export async function fetchPlaceDetails(id: string, signal?: AbortSignal): Promise<PlaceDetails> {
  const response = await request<PlaceApi>(`/api/places/${id}`, signal);
  return normalizePlace(response);
}

export async function fetchRoutePath(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
  signal?: AbortSignal,
): Promise<[number, number][]> {
  const url =
    `https://router.project-osrm.org/route/v1/walking/${from.lon},${from.lat};${to.lon},${to.lat}` +
    '?overview=full&geometries=geojson';
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error('Failed to build route');
  }
  const data = (await response.json()) as {
    routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
  };
  const coordinates = data.routes?.[0]?.geometry?.coordinates;
  if (!coordinates || !coordinates.length) {
    return [
      [from.lat, from.lon],
      [to.lat, to.lon],
    ];
  }
  return coordinates.map(([lon, lat]) => [lat, lon]);
}

export async function login(email: string, password: string): Promise<{ access_token: string }> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json() as Promise<{ access_token: string }>;
}
