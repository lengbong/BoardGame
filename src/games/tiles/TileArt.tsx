import { ShapeIcon } from '../../components/shapes';
import { TILE_COLOR_INFO, tileLabel } from './tiles';
import type { Tile } from './types';

/**
 * 이 프로젝트에서 직접 디자인한 타일: 상아색 타일 위에 색 숫자와 색 모양(● ◆ 잎 ★).
 * 조커는 네 가지 색 별에 웃는 얼굴. 판 위의 조커는 대신하는 숫자를 작게 보여 준다.
 */
export function TileFace({ tile, jokerValue }: { tile: Tile; jokerValue?: number }) {
  if (tile.joker) {
    return (
      <span className="tl-tile tl-joker" role="img" aria-label={jokerValue ? `조커 (${jokerValue})` : '조커'}>
        <span className="tl-joker-star" />
        <svg viewBox="0 0 20 20" className="tl-joker-face" aria-hidden="true">
          <circle cx={7.2} cy={9} r={1.3} fill="#2a2a33" />
          <circle cx={12.8} cy={9} r={1.3} fill="#2a2a33" />
          <path d="M6.6 12.2 Q10 15.6 13.4 12.2" fill="none" stroke="#2a2a33" strokeWidth={1.4} strokeLinecap="round" />
        </svg>
        {jokerValue ? <span className="tl-joker-value">{jokerValue}</span> : null}
      </span>
    );
  }
  const info = TILE_COLOR_INFO[tile.color!];
  return (
    <span className="tl-tile" style={{ color: info.main }} role="img" aria-label={tileLabel(tile)}>
      <span className="tl-num">{tile.value}</span>
      <ShapeIcon shape={info.shape} color={info.main} className="tl-shape" />
    </span>
  );
}
