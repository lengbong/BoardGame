// 도시 그림 (scripts/fetch-city-images.py 로 받은 위키미디어 공용 이미지)
const files = import.meta.glob<string>('./assets/cities/*.webp', { eager: true, import: 'default', query: '?url' });

export const CITY_IMAGES: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.replace(/^.*\/(.+)\.webp$/, '$1'), url]),
);
