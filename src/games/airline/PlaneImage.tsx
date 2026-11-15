import type { ShapeKind } from '../../components/shapes';
import { MODEL } from './aircraft';
import { SHAPES } from './aircraftShapes';
import { FREIGHTER_SHAPES } from './freighterShapes';
import { NEUTRAL_LIVERY, companyLivery, renderPlaneSvg, svgDataUrl, type Livery } from './plane3d';

/** 회사 칠 (없으면 흰 몸통 + 파란 줄) */
export interface Paint {
  main: string;
  dark: string;
  shape?: ShapeKind;
}

const CACHE_MAX = 240;
const cache = new Map<string, string>();

/** 기종 그림 data URL (칠마다 한 번만 그린다) */
export function planeImageUrl(model: string, paint?: Paint | null): string | undefined {
  const shape = SHAPES[model] ?? FREIGHTER_SHAPES[model];
  if (!shape) return undefined;
  const key = paint ? `${model}|${paint.main}|${paint.dark}|${paint.shape ?? ''}` : model;
  const hit = cache.get(key);
  if (hit) {
    // 가장 최근에 쓴 것을 뒤로 (오래 안 쓴 것부터 지운다)
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const livery: Livery = paint ? companyLivery(paint.main, paint.dark, paint.shape) : NEUTRAL_LIVERY;
  const url = svgDataUrl(renderPlaneSvg(shape, livery));
  cache.set(key, url);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return url;
}

interface PlaneImageProps {
  model: string;
  paint?: Paint | null;
  className?: string;
  /** 그림 오른쪽 아래에 쓰는 기종 이름 (옛 게임 화면처럼) */
  label?: string;
  alt?: string;
}

/** 실제 치수로 그린 비스듬한 기종 그림 (16:9) */
export function PlaneImage({ model, paint, className, label, alt }: PlaneImageProps) {
  const url = planeImageUrl(model, paint);
  const m = MODEL[model];
  const name = alt ?? (m ? `${m.maker} ${m.name} 그림` : model);
  return (
    <figure className={`al-plane-img${className ? ` ${className}` : ''}`}>
      {url && <img src={url} alt={name} decoding="async" draggable={false} />}
      {label && <figcaption>{label}</figcaption>}
    </figure>
  );
}
