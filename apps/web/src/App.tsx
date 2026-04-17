import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Place, PlaceCategory } from '@mapscout/shared-types';
import { fetchNearby, fetchPlaceDetails, fetchRoutePath } from './api';
import { MapView } from './MapView';
import { PlacesList } from './PlacesList';
import { useCurrentLocation } from './useCurrentLocation';

type UiCategory = PlaceCategory | 'all';
const categories: UiCategory[] = ['all', 'cafe', 'park', 'museum', 'restaurant', 'landmark', 'hotel'];
const allPlaceCategories: PlaceCategory[] = ['cafe', 'park', 'museum', 'restaurant', 'landmark', 'hotel'];
const FAVORITES_KEY = 'mapscout_history_guest';
const VIEWED_HISTORY_KEY = 'mapscout_viewed_history_guest';

type VisitRecord = {
  id: string;
  name: string;
  category: PlaceCategory;
  description: string;
  photoUrl?: string;
  distance: number;
  at: string;
  coordinates: { lat: number; lon: number };
};

type ViewedRecord = VisitRecord & {
  viewedAt: string;
};

function buildPlaceKey(place: { id: string; category: PlaceCategory; coordinates: { lat: number; lon: number } }): string {
  return `${place.id}::${place.category}::${place.coordinates.lat.toFixed(6)}::${place.coordinates.lon.toFixed(6)}`;
}

function visitRecordToPlace(item: VisitRecord): Place {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description,
    photoUrl: item.photoUrl,
    distance: item.distance,
    coordinates: item.coordinates,
  };
}

function distanceMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const earth = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return earth * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function App() {
  const [selectedCategories, setSelectedCategories] = useState<UiCategory[]>(['all']);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedPlaceKey, setSelectedPlaceKey] = useState<string | null>(null);
  const [selectedFromHistory, setSelectedFromHistory] = useState<Place | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [showFavoritesPanel, setShowFavoritesPanel] = useState(false);
  const [showViewedPanel, setShowViewedPanel] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ lat: number; lon: number; tick: number } | null>(null);
  const location = useCurrentLocation();
  const activeCategories = useMemo<PlaceCategory[]>(
    () =>
      selectedCategories.includes('all')
        ? allPlaceCategories
        : (selectedCategories as PlaceCategory[]),
    [selectedCategories],
  );

  const nearbyQuery = useQuery({
    queryKey: ['nearby', location.coords?.lat, location.coords?.lon, [...activeCategories].sort().join('|')],
    queryFn: async ({ signal }) => {
      const responses = await Promise.all(
        activeCategories.map((item) => fetchNearby(location.coords!.lat, location.coords!.lon, item, signal)),
      );
      const byId = new Map<string, Place>();
      for (const response of responses) {
        for (const place of response.places) {
          const placeKey = buildPlaceKey(place);
          if (!byId.has(placeKey)) byId.set(placeKey, place);
        }
      }
      return { places: [...byId.values()].sort((a, b) => a.distance - b.distance) };
    },
    enabled: !!location.coords,
  });

  const placeDetailsQuery = useQuery({
    queryKey: ['place-details', selectedPlaceId],
    queryFn: ({ signal }) => fetchPlaceDetails(selectedPlaceId!, signal),
    enabled: !!selectedPlaceId,
  });

  const places = nearbyQuery.data?.places ?? [];
  const selectedPlace = useMemo(
    () =>
      places.find((place) =>
        selectedPlaceKey ? buildPlaceKey(place) === selectedPlaceKey : place.id === selectedPlaceId,
      ) ?? null,
    [places, selectedPlaceId, selectedPlaceKey],
  );
  const selectedPlaceDetails = placeDetailsQuery.data ?? selectedPlace ?? selectedFromHistory;
  const routeQuery = useQuery({
    queryKey: ['route', location.coords, selectedPlaceDetails?.id, showRoute],
    queryFn: ({ signal }) =>
      fetchRoutePath(location.coords!, selectedPlaceDetails!.coordinates, signal),
    enabled: !!(showRoute && location.coords && selectedPlaceDetails),
  });

  const [favorites, setFavorites] = useState<VisitRecord[]>([]);
  const [viewedHistory, setViewedHistory] = useState<ViewedRecord[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) {
      setFavorites([]);
    } else {
      const parsed = JSON.parse(raw) as Array<Partial<VisitRecord>>;
      const normalized: VisitRecord[] = parsed.map((item) => ({
        id: item.id ?? crypto.randomUUID(),
        name: item.name ?? 'Unknown place',
        category: (item.category as PlaceCategory) ?? 'landmark',
        description: item.description ?? 'Visited place',
        photoUrl: item.photoUrl,
        distance: item.distance ?? 0,
        at: item.at ?? new Date().toISOString(),
        coordinates: item.coordinates ?? { lat: 0, lon: 0 },
      }));
      setFavorites(normalized);
    }

    const viewedRaw = localStorage.getItem(VIEWED_HISTORY_KEY);
    if (!viewedRaw) {
      setViewedHistory([]);
    } else {
      const parsedViewed = JSON.parse(viewedRaw) as Array<Partial<ViewedRecord>>;
      const normalizedViewed: ViewedRecord[] = parsedViewed.map((item) => ({
        id: item.id ?? crypto.randomUUID(),
        name: item.name ?? 'Unknown place',
        category: (item.category as PlaceCategory) ?? 'landmark',
        description: item.description ?? 'Viewed place',
        photoUrl: item.photoUrl,
        distance: item.distance ?? 0,
        at: item.at ?? new Date().toISOString(),
        viewedAt: item.viewedAt ?? item.at ?? new Date().toISOString(),
        coordinates: item.coordinates ?? { lat: 0, lon: 0 },
      }));
      setViewedHistory(normalizedViewed);
    }
  }, []);

  const removeFavorite = (place: { id: string; category: PlaceCategory; coordinates: { lat: number; lon: number } }) => {
    const targetKey = buildPlaceKey(place);
    const next = favorites.filter((item) => buildPlaceKey(item) !== targetKey);
    setFavorites(next);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  };

  const toggleFavorite = () => {
    if (!selectedPlaceDetails) return;
    const selectedKey = buildPlaceKey(selectedPlaceDetails);
    const exists = favorites.some((item) => buildPlaceKey(item) === selectedKey);
    if (exists) {
      const next = favorites.filter((item) => buildPlaceKey(item) !== selectedKey);
      setFavorites(next);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return;
    }
    const record: VisitRecord = {
      id: selectedPlaceDetails.id,
      name: selectedPlaceDetails.name,
      category: selectedPlaceDetails.category,
      description: selectedPlaceDetails.description,
      photoUrl: selectedPlaceDetails.photoUrl,
      distance: effectiveDistance,
      at: new Date().toISOString(),
      coordinates: selectedPlaceDetails.coordinates,
    };
    const next = [record, ...favorites].slice(0, 40);
    setFavorites(next);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  };

  const effectiveDistance =
    selectedPlace?.distance ??
    (selectedPlaceDetails && location.coords
      ? distanceMeters(location.coords, selectedPlaceDetails.coordinates)
      : 600);
  const estimatedMinutes = selectedPlaceDetails ? Math.max(2, Math.round(effectiveDistance / 80)) : 0;
  const fallbackImage = 'https://placehold.co/640x360?text=MapScout+Place';
  const isFavorite = !!selectedPlaceDetails && favorites.some((item) => buildPlaceKey(item) === buildPlaceKey(selectedPlaceDetails));
  const favoritePlaceKeys = useMemo(() => new Set(favorites.map((item) => buildPlaceKey(item))), [favorites]);

  const filteredPlaces = places.filter((place) =>
    place.name.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );

  const mapSourcePlaces = useMemo(() => {
    // Map markers should stay stable regardless of search input.
    // Favorites are added only for currently active categories.
    const byKey = new Map<string, Place>();
    for (const place of places) {
      byKey.set(buildPlaceKey(place), place);
    }
    for (const favorite of favorites) {
      if (!activeCategories.includes(favorite.category)) continue;
      const place = visitRecordToPlace(favorite);
      const key = buildPlaceKey(place);
      if (!byKey.has(key)) {
        byKey.set(key, place);
      }
    }
    return [...byKey.values()];
  }, [places, favorites, activeCategories]);

  const mapPlaces = useMemo(() => {
    if (!selectedPlaceDetails) return mapSourcePlaces;
    const selectedKey = buildPlaceKey(selectedPlaceDetails);
    const exists = mapSourcePlaces.some((item) => buildPlaceKey(item) === selectedKey);
    return exists
      ? mapSourcePlaces
      : [...mapSourcePlaces, { ...selectedPlaceDetails, distance: selectedPlace?.distance ?? effectiveDistance }];
  }, [mapSourcePlaces, selectedPlaceDetails, selectedPlace, effectiveDistance]);

  const goToPlace = (place: Place) => {
    const targetKey = buildPlaceKey(place);
    if (selectedPlaceKey === targetKey && !selectedFromHistory) {
      closePlaceCard();
      return;
    }
    setSelectedPlaceId(place.id);
    setSelectedPlaceKey(targetKey);
    setSelectedFromHistory(null);
    setShowRoute(false);
    setFocusPoint({ ...place.coordinates, tick: Date.now() });
  };
  const goToMyLocation = () => {
    if (!location.coords) return;
    setFocusPoint({ ...location.coords, tick: Date.now() });
  };


  const closePlaceCard = () => {
    setSelectedPlaceId(null);
    setSelectedPlaceKey(null);
    setSelectedFromHistory(null);
    setShowRoute(false);
  };

  useEffect(() => {
    setSelectedPlaceId(null);
    setSelectedPlaceKey(null);
    setSelectedFromHistory(null);
    setShowRoute(false);
  }, [selectedCategories]);

  useEffect(() => {
    if (!selectedPlaceDetails) return;
    const historyRecord: ViewedRecord = {
      id: selectedPlaceDetails.id,
      name: selectedPlaceDetails.name,
      category: selectedPlaceDetails.category,
      description: selectedPlaceDetails.description,
      photoUrl: selectedPlaceDetails.photoUrl,
      distance: effectiveDistance,
      at: new Date().toISOString(),
      viewedAt: new Date().toISOString(),
      coordinates: selectedPlaceDetails.coordinates,
    };
    setViewedHistory((current) => {
      const next = [historyRecord, ...current].slice(0, 80);
      localStorage.setItem(VIEWED_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, [selectedPlaceDetails?.id]);

  const openSavedPlace = (item: VisitRecord | ViewedRecord, panel: 'favorites' | 'viewed') => {
    const targetKey = buildPlaceKey(item);
    if (selectedPlaceKey === targetKey) {
      closePlaceCard();
      if (panel === 'favorites') setShowFavoritesPanel(false);
      if (panel === 'viewed') setShowViewedPanel(false);
      return;
    }
    setSelectedPlaceId(item.id);
    setSelectedPlaceKey(targetKey);
    setSelectedFromHistory({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      photoUrl: item.photoUrl,
      distance: item.distance,
      coordinates: item.coordinates,
    });
    setShowRoute(false);
    setFocusPoint({ ...item.coordinates, tick: Date.now() });
    if (panel === 'favorites') setShowFavoritesPanel(false);
    if (panel === 'viewed') setShowViewedPanel(false);
  };

  const toggleCategory = (item: UiCategory) => {
    setSelectedCategories((current) => {
      if (item === 'all') return ['all'];
      const withoutAll = current.filter((entry) => entry !== 'all');
      const exists = withoutAll.includes(item);
      const next = exists ? withoutAll.filter((entry) => entry !== item) : [...withoutAll, item];
      return next.length ? next : ['all'];
    });
  };

  return (
    <div className={`layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <button
        className="sidebar-collapse-toggle"
        onClick={() => setIsSidebarCollapsed((current) => !current)}
        aria-label={isSidebarCollapsed ? 'Expand left panel' : 'Collapse left panel'}
      >
        {isSidebarCollapsed ? '›' : '‹'}
      </button>
      <aside className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`} onClick={closePlaceCard}>
        <div className="sidebar-top">
          <h1>MapScout</h1>
          <p className="muted">Nearby places guide</p>
          <input
            className="account-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            placeholder="Search places in selected category..."
          />

          <div className="categories">
            {categories.map((item) => (
              <button
                key={item}
                className={`${selectedCategories.includes(item) ? 'active' : ''} ${item === 'all' ? 'all-category' : ''}`.trim()}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleCategory(item);
                }}
              >
                {item}
              </button>
            ))}
          </div>

          {location.error && <p className="error">{location.error}</p>}
          {nearbyQuery.isLoading && <p className="muted">Loading nearby places...</p>}
          {!nearbyQuery.isLoading && location.coords && filteredPlaces.length === 0 && (
            <p className="muted">No places in selected categories nearby.</p>
          )}
        </div>
        <div className="sidebar-list-host">
          <PlacesList
            places={filteredPlaces}
            selectedPlaceId={selectedPlaceId}
            onSelect={(place) => goToPlace(place)}
          />
        </div>
      </aside>

      <main className="map-panel">
        <button className="my-location-toggle" onClick={goToMyLocation}>
          My location
        </button>
        <button
          className="history-toggle"
          onClick={() => {
            setShowFavoritesPanel(true);
          }}
        >
          Favorites
        </button>
        <button
          className="viewed-history-toggle"
          onClick={() => {
            setShowViewedPanel(true);
          }}
        >
          History
        </button>
        <MapView
          coords={location.coords}
          places={mapPlaces}
          routePoints={showRoute ? routeQuery.data ?? [] : []}
          focusPoint={focusPoint}
          onSelectPlace={(place: Place) => goToPlace(place)}
          onMapClick={closePlaceCard}
          selectedPlaceKey={selectedPlaceKey}
          favoritePlaceKeys={favoritePlaceKeys}
        />
        {selectedPlaceDetails && (
          <section className="map-details-card">
            <button className="details-close" onClick={closePlaceCard}>
              ×
            </button>
            <img
              src={selectedPlaceDetails.photoUrl ?? fallbackImage}
              alt={selectedPlaceDetails.name}
              onError={(event) => {
                event.currentTarget.src = fallbackImage;
              }}
            />
            <div className="details-body">
              <h3>{selectedPlaceDetails.name}</h3>
              <p className="muted">{selectedPlaceDetails.category}</p>
              <p>{selectedPlaceDetails.description}</p>
              {location.coords && (
                <p className="muted">
                  {Math.round(effectiveDistance)} m away, about {estimatedMinutes} min walk
                </p>
              )}
              {routeQuery.isError && (
                <p className="error">Route service unavailable. You can open external maps.</p>
              )}
              <div className="details-actions">
                <button onClick={() => setShowRoute((current) => !current)}>
                  {showRoute ? 'Hide route' : 'Build route'}
                </button>
                <button onClick={toggleFavorite}>
                  {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                </button>
                {location.coords && (
                  <a
                    className="route-link"
                    href={`https://www.google.com/maps/dir/?api=1&origin=${location.coords.lat},${location.coords.lon}&destination=${selectedPlaceDetails.coordinates.lat},${selectedPlaceDetails.coordinates.lon}&travelmode=walking`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps
                  </a>
                )}
              </div>
            </div>
          </section>
        )}
        <aside className={`history-drawer ${showFavoritesPanel ? 'open' : ''}`}>
          <button className="back-button" onClick={() => setShowFavoritesPanel(false)}>
            ← Back
          </button>
          <h3>Favorite places</h3>
          {!favorites.length && <p className="muted">No favorites yet.</p>}
          {favorites.map((item) => (
            <div
              key={`${item.id}-${item.at}`}
              className="history-row"
              onClick={() => openSavedPlace(item, 'favorites')}
              role="button"
              tabIndex={0}
            >
              <button className="history-open">
                <b>{item.name}</b>
              </button>
              <span className="history-category">{item.category}</span>
              <span>{new Date(item.at).toLocaleString()}</span>
              <div className="history-actions">
                <button
                  className="history-action danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeFavorite(item);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </aside>
        <aside className={`viewed-history-drawer ${showViewedPanel ? 'open' : ''}`}>
          <button className="back-button" onClick={() => setShowViewedPanel(false)}>
            ← Back
          </button>
          <h3>Viewed places history</h3>
          {!viewedHistory.length && <p className="muted">No viewed places yet.</p>}
          {viewedHistory.map((item) => (
            <div
              key={`${item.id}-${item.viewedAt}`}
              className="history-row"
              onClick={() => openSavedPlace(item, 'viewed')}
              role="button"
              tabIndex={0}
            >
              <button className="history-open">
                <b>{item.name}</b>
              </button>
              <span className="history-category">{item.category}</span>
              <span>{new Date(item.viewedAt).toLocaleString()}</span>
            </div>
          ))}
        </aside>
      </main>
    </div>
  );
}
