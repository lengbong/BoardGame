import type { ReactElement } from 'react';

/**
 * 색마다 붙이는 모양 (색을 구별하기 어려운 사람도 알아볼 수 있게).
 * 카드 게임과 타일 게임이 함께 쓴다.
 */
export type ShapeKind = 'circle' | 'star' | 'leaf' | 'diamond';

/** (cx, cy)를 가운데로 하는 반지름 r짜리 색 모양 */
export function shapeElement(shape: ShapeKind, cx: number, cy: number, r: number, fill: string, extra?: object): ReactElement {
  switch (shape) {
    case 'circle':
      return <circle cx={cx} cy={cy} r={r * 0.85} fill={fill} {...extra} />;
    case 'star': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = ((-90 + i * 36) * Math.PI) / 180;
        const rr = i % 2 === 0 ? r : r * 0.45;
        return `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`;
      });
      return <polygon points={pts.join(' ')} fill={fill} {...extra} />;
    }
    case 'leaf':
      return (
        <path
          d={`M0 ${-r} C${r * 0.95} ${-r * 0.45} ${r * 0.95} ${r * 0.45} 0 ${r} C${-r * 0.95} ${r * 0.45} ${-r * 0.95} ${-r * 0.45} 0 ${-r}Z`}
          transform={`translate(${cx} ${cy}) rotate(35)`}
          fill={fill}
          {...extra}
        />
      );
    case 'diamond':
      return <polygon points={`${cx},${cy - r} ${cx + r * 0.75},${cy} ${cx},${cy + r} ${cx - r * 0.75},${cy}`} fill={fill} {...extra} />;
  }
}

/** 모양 하나만 그린 작은 SVG */
export function ShapeIcon({ shape, color, size = 12, className }: { shape: ShapeKind; color: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" className={className}>
      {shapeElement(shape, 10, 10, 9, color)}
    </svg>
  );
}
