import type { CategoryLabels, Place, PlaceCategory } from '@mapscout/shared-types';

export const categoryLabels: CategoryLabels<PlaceCategory> = {
  cafe: 'Cafe places',
  park: 'Park places',
  museum: 'Museum places',
};

export type UiPlace = Place & { selected?: boolean };
