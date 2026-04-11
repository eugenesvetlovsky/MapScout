import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
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
  selectedPlaceId?: string | null;
};

const fallbackCenter = { lat: 55.751244, lon: 37.618423 };

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
  selectedPlaceId,
}: Props) {
  const center = coords ?? fallbackCenter;
  return (
    <MapContainer center={[center.lat, center.lon]} zoom={14} className="map">
      <RecenterOnUser coords={coords} />
      <FocusOnTarget focusPoint={focusPoint} />
      <HandleMapClick onMapClick={onMapClick} />
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {coords && <Marker position={[coords.lat, coords.lon]} icon={userIcon} />}
      <MarkerClusterGroup chunkedLoading>
        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.coordinates.lat, place.coordinates.lon]}
            icon={selectedPlaceId && place.id === selectedPlaceId ? selectedPlaceIcon : placeIcon}
            eventHandlers={{ click: () => onSelectPlace(place) }}
          />
        ))}
      </MarkerClusterGroup>
      {routePoints.length > 1 && (
        <Polyline
          positions={routePoints}
          pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.9 }}
        />
      )}
    </MapContainer>
  );
}
