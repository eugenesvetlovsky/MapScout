export type PlaceCategory = 'cafe' | 'park' | 'museum' | 'restaurant' | 'landmark' | 'hotel';

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  description: string;
  photoUrl?: string;
  coordinates: Coordinates;
  distance: number;
}

export type NearbyResponse = {
  places: Place[];
};

export type PlaceCard = Pick<Place, 'id' | 'name' | 'category' | 'distance'>;
export type PlaceDetails = Omit<Place, 'distance'>;
export type PlacePatch = Partial<PlaceDetails>;
export type StrictPlace = Required<Place>;
export type PlacesByCategory = Record<PlaceCategory, Place[]>;

export type ApiPath = `/api/${'places' | 'history' | 'auth'}/${string}`;

export type ApiResult<T> = T extends object ? { data: T; ok: true } : { ok: false; error: string };

export type NearbyFetcher = (lat: number, lon: number, category: PlaceCategory) => Promise<NearbyResponse>;
export type NearbyFetcherResult = Awaited<ReturnType<NearbyFetcher>>;

export type CategoryLabels<T extends string> = {
  [K in T]: `${Capitalize<K>} places`;
};
