import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type { Place } from '@mapscout/shared-types';
import { useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type Props = {
  coords: { lat: number; lon: number } | null;
  places: Place[];
  routePoints: [number, number][];
  focusPoint: { lat: number; lon: number; tick: number } | null;
  onSelectPlace: (place: Place) => void;
  onMapClick?: () => void;
  selectedPlaceKey?: string | null;
  favoritePlaceKeys?: Set<string>;
};

const fallbackCenter = { lat: 55.751244, lon: 37.618423 };

function buildPlaceKey(place: { id: string; category: Place['category']; coordinates: { lat: number; lon: number } }): string {
  return `${place.id}::${place.category}::${place.coordinates.lat.toFixed(6)}::${place.coordinates.lon.toFixed(6)}`;
}

const userIcon = L.divIcon({
  html: '<div class="user-pin"><span class="user-pin-dot"></span></div>',
  className: 'user-pin-wrapper',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const placeIcon = L.divIcon({
  html: '<div class="place-pin"><span></span></div>',
  className: 'place-pin-wrapper',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const selectedPlaceIcon = L.divIcon({
  html: '<div class="place-pin selected"><span></span></div>',
  className: 'place-pin-wrapper',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const favoritePlaceIcon = L.divIcon({
  html: '<div class="place-pin favorite"><span></span></div>',
  className: 'place-pin-wrapper',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const selectedFavoritePlaceIcon = L.divIcon({
  html: '<div class="place-pin selected favorite"><span></span></div>',
  className: 'place-pin-wrapper',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function RecenterOnUser({
  coords,
}: {
  coords: {
    lat: number;
    lon: number;
  } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.setView([coords.lat, coords.lon], 14, { animate: true });
    }
  }, [coords, map]);
  return null;
}

function FocusOnTarget({
  focusPoint,
}: {
  focusPoint: { lat: number; lon: number; tick: number } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (focusPoint) {
      map.setView([focusPoint.lat, focusPoint.lon], 16, { animate: true });
    }
  }, [focusPoint, map]);
  return null;
}

function HandleMapClick({ onMapClick }: { onMapClick?: () => void }) {
  useMapEvents({
    click: () => onMapClick?.(),
  });
  return null;
}

export function MapView({
  coords,
  places,
  routePoints,
  focusPoint,
  onSelectPlace,
  onMapClick,
  selectedPlaceKey,
  favoritePlaceKeys,
}: Props) {
  const center = coords ?? fallbackCenter;
  const selectedPlace = selectedPlaceKey
    ? places.find((p) => buildPlaceKey(p) === selectedPlaceKey) ?? null
    : null;
  const clusteredPlaces = selectedPlaceKey
    ? places.filter((p) => buildPlaceKey(p) !== selectedPlaceKey)
    : places;

  return (
    <MapContainer center={[center.lat, center.lon]} zoom={14} className="map">
      <RecenterOnUser coords={coords} />
      <FocusOnTarget focusPoint={focusPoint} />
      <HandleMapClick onMapClick={onMapClick} />
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {coords && <Marker position={[coords.lat, coords.lon]} icon={userIcon} />}
      <MarkerClusterGroup chunkedLoading>
        {clusteredPlaces.map((place) => (
          <Marker
            key={buildPlaceKey(place)}
            position={[place.coordinates.lat, place.coordinates.lon]}
            icon={favoritePlaceKeys?.has(buildPlaceKey(place)) ? favoritePlaceIcon : placeIcon}
            eventHandlers={{ click: () => onSelectPlace(place) }}
          >
            <Tooltip direction="top" offset={[0, -12]} className="place-tooltip">
              <strong>{place.name}</strong>
              <br />
              <span>{place.category}</span>
            </Tooltip>
          </Marker>
        ))}
      </MarkerClusterGroup>
      {selectedPlace && (
        <Marker
          key={`selected-${buildPlaceKey(selectedPlace)}`}
          position={[selectedPlace.coordinates.lat, selectedPlace.coordinates.lon]}
          icon={favoritePlaceKeys?.has(buildPlaceKey(selectedPlace)) ? selectedFavoritePlaceIcon : selectedPlaceIcon}
          zIndexOffset={1000}
          eventHandlers={{ click: () => onSelectPlace(selectedPlace) }}
        >
          <Tooltip direction="top" offset={[0, -12]} className="place-tooltip">
            <strong>{selectedPlace.name}</strong>
            <br />
            <span>{selectedPlace.category}</span>
          </Tooltip>
        </Marker>
      )}
      {routePoints.length > 1 && (
        <Polyline
          positions={routePoints}
          pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.9 }}
        />
      )}
    </MapContainer>
  );
}
