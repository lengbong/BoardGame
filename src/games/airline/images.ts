import { MODEL, MODELS } from './aircraft';
import { CITIES, CITY } from './cities';
import { IMAGE_CREDITS, type ImageCredit } from './imageCredits';
import { REAL_AIRLINE, REAL_AIRLINES } from './realAirlines';

/**
 * 위키미디어 공용에서 받은 사진 (scripts/fetch-airline-images.py).
 * 한 파일로 묶을 때 그림이 data URL로 들어간다. 사진이 없는 항목은 undefined → 화면에서 그린 그림으로 대신한다.
 */

type Kind = 'aircraft' | 'cities' | 'airlines';

/** './assets/aircraft/b747-400.webp' → { 'b747-400': url } */
function byId(files: Record<string, string>): ReadonlyMap<string, string> {
  return new Map(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1).replace(/\.webp$/, ''), url]));
}

const PHOTOS: Record<Kind, ReadonlyMap<string, string>> = {
  aircraft: byId(import.meta.glob('./assets/aircraft/*.webp', { eager: true, import: 'default' }) as Record<string, string>),
  cities: byId(import.meta.glob('./assets/cities/*.webp', { eager: true, import: 'default' }) as Record<string, string>),
  airlines: byId(import.meta.glob('./assets/airlines/*.webp', { eager: true, import: 'default' }) as Record<string, string>),
};

/** 기종 사진 (16:9, 400×225) */
export function aircraftPhoto(modelId: string): string | undefined {
  return PHOTOS.aircraft.get(modelId);
}

/** 도시 명소 사진 (4:3, 320×240) */
export function cityPhoto(cityId: string): string | undefined {
  return PHOTOS.cities.get(cityId);
}

/** 실제 항공사 비행기 사진 (16:9, 400×225) */
export function airlinePhoto(airlineId: string): string | undefined {
  return PHOTOS.airlines.get(airlineId);
}

/** 'aircraft/<id>' | 'cities/<id>' | 'airlines/<id>' 사진의 출처 */
export function photoCredit(key: string): ImageCredit | undefined {
  return Object.hasOwn(IMAGE_CREDITS, key) ? IMAGE_CREDITS[key] : undefined;
}

export interface PhotoCreditEntry extends ImageCredit {
  key: string;
  /** 화면에 보일 이름 (기종·도시·항공사 이름) */
  title: string;
}

const ORDER: { kind: Kind; ids: readonly string[]; title: (id: string) => string | undefined }[] = [
  { kind: 'aircraft', ids: MODELS.map((m) => m.id), title: (id) => MODEL[id] && `${MODEL[id].maker} ${MODEL[id].name}` },
  { kind: 'cities', ids: CITIES.map((c) => c.id), title: (id) => CITY[id]?.name },
  { kind: 'airlines', ids: REAL_AIRLINES.map((a) => a.id), title: (id) => REAL_AIRLINE[id]?.name },
];

/** '사진 출처' 화면용: 실제로 들어 있는 사진의 출처를 기종 → 도시 → 항공사 순서로 */
export const ALL_CREDITS: readonly PhotoCreditEntry[] = ORDER.flatMap(({ kind, ids, title }) =>
  [...PHOTOS[kind].keys()]
    .sort((a, b) => (ids.indexOf(a) + 1 || Infinity) - (ids.indexOf(b) + 1 || Infinity) || a.localeCompare(b))
    .flatMap((id) => {
      const key = `${kind}/${id}`;
      const credit = photoCredit(key);
      return credit ? [{ key, title: title(id) ?? id, ...credit }] : [];
    }),
);
