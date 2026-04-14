import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList as List } from 'react-window';
import type { Place } from '@mapscout/shared-types';

type Props = {
  places: Place[];
  selectedPlaceId: string | null;
  onSelect: (place: Place) => void;
};

export function PlacesList({ places, selectedPlaceId, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<List>(null);
  const [listHeight, setListHeight] = useState(0);

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => setListHeight(el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const selectedIndex = useMemo(() => {
    if (!selectedPlaceId) return -1;
    return places.findIndex((place) => place.id === selectedPlaceId);
  }, [places, selectedPlaceId]);

  useEffect(() => {
    if (selectedIndex < 0 || listHeight <= 0) return;
    listRef.current?.scrollToItem(selectedIndex, 'smart');
  }, [selectedIndex, listHeight]);

  return (
    <div ref={hostRef} className="places-list-measure">
      {listHeight > 0 && (
        <List
          ref={listRef}
          height={listHeight}
          width="100%"
          itemCount={places.length}
          itemSize={96}
          itemData={{ places }}
        >
          {({ index, style, data }) => {
            const place = data.places[index] as Place;
            return (
              <div style={style} className={`place-row ${selectedPlaceId === place.id ? 'selected' : ''}`}>
                <button
                  className="place-main"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(place);
                  }}
                >
                  <div>{place.name}</div>
                  <small>
                    {place.category} - {Math.round(place.distance)} m
                  </small>
                </button>
              </div>
            );
          }}
        </List>
      )}
    </div>
  );
}
