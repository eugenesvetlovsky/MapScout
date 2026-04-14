import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Place, PlaceCategory } from '@mapscout/shared-types';
import { fetchNearby, fetchPlaceDetails, fetchRoutePath } from './api';
import { MapView } from './MapView';
import { PlacesList } from './PlacesList';
import { useCurrentLocation } from './useCurrentLocation';

type UiCategory = PlaceCategory | 'all';
const categories: UiCategory[] = ['all', 'cafe', 'park', 'museum', 'restaurant', 'landmark', 'hotel'];
const HISTORY_KEY = 'mapscout_history_guest';

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
  const [category, setCategory] = useState<UiCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedFromHistory, setSelectedFromHistory] = useState<Place | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ lat: number; lon: number; tick: number } | null>(null);
  const location = useCurrentLocation();

  const nearbyQuery = useQuery({
    queryKey: ['nearby', location.coords?.lat, location.coords?.lon, category],
    queryFn: ({ signal }) =>
      fetchNearby(location.coords!.lat, location.coords!.lon, category, signal),
    enabled: !!location.coords,
  });

  const placeDetailsQuery = useQuery({
    queryKey: ['place-details', selectedPlaceId],
    queryFn: ({ signal }) => fetchPlaceDetails(selectedPlaceId!, signal),
    enabled: !!selectedPlaceId,
  });

  const places = nearbyQuery.data?.places ?? [];
  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );
  const selectedPlaceDetails = placeDetailsQuery.data ?? selectedPlace ?? selectedFromHistory;
  const routeQuery = useQuery({
    queryKey: ['route', location.coords, selectedPlaceDetails?.id, showRoute],
    queryFn: ({ signal }) =>
      fetchRoutePath(location.coords!, selectedPlaceDetails!.coordinates, signal),
    enabled: !!(showRoute && location.coords && selectedPlaceDetails),
  });

  const [history, setHistory] = useState<VisitRecord[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      setHistory([]);
      return;
    }
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
    setHistory(normalized);
  }, []);

  const removeVisit = (placeId: string) => {
    const next = history.filter((item) => item.id !== placeId);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const toggleVisit = () => {
    if (!selectedPlaceDetails) return;
    const exists = history.some((item) => item.id === selectedPlaceDetails.id);
    if (exists) {
      removeVisit(selectedPlaceDetails.id);
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
    const next = [record, ...history].slice(0, 40);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const effectiveDistance =
    selectedPlace?.distance ??
    (selectedPlaceDetails && location.coords
      ? distanceMeters(location.coords, selectedPlaceDetails.coordinates)
      : 600);
  const estimatedMinutes = selectedPlaceDetails ? Math.max(2, Math.round(effectiveDistance / 80)) : 0;
  const fallbackImage = 'https://placehold.co/640x360?text=MapScout+Place';
  const isVisited = !!selectedPlaceDetails && history.some((item) => item.id === selectedPlaceDetails.id);

  const filteredPlaces = places.filter((place) =>
    place.name.toLowerCase().includes(searchTerm.trim().toLowerCase()),
  );
  const mapPlaces = useMemo(() => {
    if (!selectedPlaceDetails) return filteredPlaces;
    const exists = filteredPlaces.some((item) => item.id === selectedPlaceDetails.id);
    return exists
      ? filteredPlaces
      : [...filteredPlaces, { ...selectedPlaceDetails, distance: selectedPlace?.distance ?? effectiveDistance }];
  }, [filteredPlaces, selectedPlaceDetails, selectedPlace, effectiveDistance]);

  const goToPlace = (place: { id: string; coordinates: { lat: number; lon: number } }) => {
    if (selectedPlaceId === place.id && !selectedFromHistory) {
      closePlaceCard();
      return;
    }
    setSelectedPlaceId(place.id);
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
    setSelectedFromHistory(null);
    setShowRoute(false);
  };

  useEffect(() => {
    setSelectedPlaceId(null);
    setSelectedFromHistory(null);
    setShowRoute(false);
  }, [category]);

  const openFromHistory = (item: VisitRecord) => {
    if (selectedPlaceId === item.id) {
      closePlaceCard();
      setShowHistoryPanel(false);
      return;
    }
    setSelectedPlaceId(item.id);
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
    setShowHistoryPanel(false);
  };

  return (
    <div className="layout">
      <aside className="sidebar" onClick={closePlaceCard}>
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
                className={`${item === category ? 'active' : ''} ${item === 'all' ? 'all-category' : ''}`.trim()}
                onClick={(event) => {
                  event.stopPropagation();
                  setCategory(item);
                }}
              >
                {item}
              </button>
            ))}
          </div>

          {location.error && <p className="error">{location.error}</p>}
          {nearbyQuery.isLoading && <p className="muted">Loading nearby places...</p>}
          {!nearbyQuery.isLoading && location.coords && filteredPlaces.length === 0 && (
            <p className="muted">No places in this category nearby.</p>
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
            setShowHistoryPanel(true);
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
          selectedPlaceId={selectedPlaceId}
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
              {selectedPlace && (
                <p className="muted">
                  {Math.round(selectedPlace.distance)} m away, about {estimatedMinutes} min walk
                </p>
              )}
              {routeQuery.isError && (
                <p className="error">Route service unavailable. You can open external maps.</p>
              )}
              <div className="details-actions">
                <button onClick={() => setShowRoute((current) => !current)}>
                  {showRoute ? 'Hide route' : 'Build route'}
                </button>
                <button onClick={toggleVisit}>
                  {isVisited ? 'Remove from visited' : 'Add to visited'}
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
        <aside className={`history-drawer ${showHistoryPanel ? 'open' : ''}`}>
          <button className="back-button" onClick={() => setShowHistoryPanel(false)}>
            ← Back
          </button>
          <h3>Visited places</h3>
          {!history.length && <p className="muted">No visits yet.</p>}
          {history.map((item) => (
            <div
              key={`${item.id}-${item.at}`}
              className="history-row"
              onClick={() => openFromHistory(item)}
              role="button"
              tabIndex={0}
            >
              <button className="history-open">
                <b>{item.name}</b>
              </button>
              <span>{new Date(item.at).toLocaleString()}</span>
              <div className="history-actions">
                <button
                  className="history-action danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeVisit(item.id);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </aside>
      </main>
    </div>
  );
}
