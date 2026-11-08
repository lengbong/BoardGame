import type { ReactElement } from 'react';
import { CARD_COLORS, COLOR_INFO, cardLabel, type ColorShape } from './cards';
import type { Card, CardColor, CardKind } from './types';

/**
 * 이 프로젝트에서 직접 디자인한 카드 그림 (SVG, 100×150)
 * - 색 카드: 색 바탕 + 가운데 흰 타일 + 큰 숫자/기호, 모서리에 숫자와 색 모양
 * - 색 바꾸기 카드: 남색 바탕 + 네 가지 색 바람개비
 * 색마다 모양(● ★ 잎 ◆)을 붙여 색을 구별하기 어려운 사람도 알아볼 수 있다.
 */

const WILD_BG = '#262b3d';
const WILD_EDGE = '#11141e';

/** (cx, cy)를 가운데로 하는 반지름 r짜리 색 모양 */
export function shapeElement(shape: ColorShape, cx: number, cy: number, r: number, fill: string, extra?: object): ReactElement {
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

/** 네 가지 색 바람개비 (색 바꾸기 카드) */
function Pinwheel({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      {CARD_COLORS.map((c, i) => (
        <path
          key={c}
          d={`M0 0 L0 ${-r} A${r} ${r} 0 0 1 ${r} 0 Z`}
          transform={`rotate(${i * 90 - 12})`}
          fill={COLOR_INFO[c].main}
          stroke={WILD_EDGE}
          strokeWidth={r * 0.06}
          strokeLinejoin="round"
        />
      ))}
      <circle r={r * 0.22} fill="#fff" stroke={WILD_EDGE} strokeWidth={r * 0.06} />
    </g>
  );
}

/** 기능 카드 기호. size는 대략 기호의 너비 */
function ActionIcon({ kind, cx, cy, size, color, outline }: { kind: CardKind; cx: number; cy: number; size: number; color: string; outline?: string }) {
  const k = size / 70;
  const stroke = outline ?? 'none';
  switch (kind) {
    case 'skip':
      return (
        <g transform={`translate(${cx} ${cy}) scale(${k})`} fill="none" stroke={color} strokeWidth={11} strokeLinecap="round">
          <circle r={27} />
          <line x1={-18} y1={18} x2={18} y2={-18} />
        </g>
      );
    case 'reverse':
      return (
        <g transform={`translate(${cx} ${cy}) scale(${k})`} fill={color} stroke={color} strokeLinejoin="round">
          <line x1={-30} y1={-13} x2={16} y2={-13} strokeWidth={10} strokeLinecap="round" />
          <polygon points="12,-28 36,-13 12,2" strokeWidth={4} />
          <line x1={30} y1={13} x2={-16} y2={13} strokeWidth={10} strokeLinecap="round" />
          <polygon points="-12,-2 -36,13 -12,28" strokeWidth={4} />
        </g>
      );
    case 'draw2':
    case 'wild4':
      return (
        <text
          x={cx}
          y={cy}
          fontSize={size * 0.78}
          fontWeight={900}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          stroke={stroke}
          strokeWidth={size * 0.06}
          paintOrder="stroke"
          letterSpacing={-1}
        >
          {kind === 'draw2' ? '+2' : '+4'}
        </text>
      );
    default:
      return null;
  }
}

function Corner({ card, x, y, color }: { card: Card; x: number; y: number; color: CardColor | null }) {
  const label = card.kind === 'number' ? String(card.value) : card.kind === 'draw2' ? '+2' : card.kind === 'wild4' ? '+4' : null;
  return (
    <g>
      {label !== null ? (
        <text x={x} y={y} fontSize={label.length > 1 ? 17 : 20} fontWeight={900} textAnchor="middle" dominantBaseline="central" fill="#fff">
          {label}
        </text>
      ) : card.kind === 'wild' ? (
        <Pinwheel cx={x} cy={y} r={8} />
      ) : (
        <ActionIcon kind={card.kind} cx={x} cy={y} size={17} color="#fff" />
      )}
      {color && shapeElement(COLOR_INFO[color].shape, x, y + 17, 5.5, '#fff', { opacity: 0.9 })}
      {card.kind === 'number' && (card.value === 6 || card.value === 9) && (
        <line x1={x - 5} y1={y + 10} x2={x + 5} y2={y + 10} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      )}
    </g>
  );
}

export function CardFace({ card, className = '' }: { card: Card; className?: string }) {
  const wild = card.color === null;
  const info = card.color ? COLOR_INFO[card.color] : null;
  const bg = info ? info.main : WILD_BG;
  const edge = info ? info.dark : WILD_EDGE;
  return (
    <svg viewBox="0 0 100 150" className={`lc-card lc-face ${className}`} role="img" aria-label={cardLabel(card)}>
      <rect x={1} y={1} width={98} height={148} rx={11} fill={bg} stroke={edge} strokeWidth={2} />
      <path d="M2 14 Q2 2 14 2 H64 L2 78 Z" fill="#fff" opacity={wild ? 0.05 : 0.13} />
      <rect x={6} y={6} width={88} height={138} rx={8} fill="none" stroke="#fff" strokeOpacity={0.45} strokeWidth={1.5} />

      {wild ? (
        <>
          <Pinwheel cx={50} cy={75} r={card.kind === 'wild4' ? 27 : 31} />
          {card.kind === 'wild4' && <ActionIcon kind="wild4" cx={50} cy={76} size={52} color="#fff" outline={WILD_EDGE} />}
        </>
      ) : (
        <>
          <rect x={16} y={36} width={68} height={78} rx={20} fill="#fff" />
          {shapeElement(info!.shape, 50, 75, 31, info!.light)}
          {card.kind === 'number' ? (
            <>
              <text
                x={50}
                y={77}
                fontSize={56}
                fontWeight={900}
                textAnchor="middle"
                dominantBaseline="central"
                fill={info!.main}
                stroke={info!.dark}
                strokeWidth={1.6}
                paintOrder="stroke"
              >
                {card.value}
              </text>
              {(card.value === 6 || card.value === 9) && (
                <line x1={38} y1={103} x2={62} y2={103} stroke={info!.dark} strokeWidth={4} strokeLinecap="round" />
              )}
            </>
          ) : (
            <ActionIcon kind={card.kind} cx={50} cy={76} size={card.kind === 'draw2' ? 50 : 46} color={info!.main} outline={info!.dark} />
          )}
        </>
      )}

      <Corner card={card} x={16} y={20} color={card.color} />
      <g transform="rotate(180 50 75)">
        <Corner card={card} x={16} y={20} color={card.color} />
      </g>
    </svg>
  );
}

/** 카드 뒷면: CSS로 그린다 (손패가 많아도 가볍게) */
export function CardBack({ className = '' }: { className?: string }) {
  return (
    <span className={`lc-card lc-back ${className}`} aria-hidden="true">
      <span className="lc-back-emblem" />
      <span className="lc-back-text">한 장</span>
    </span>
  );
}

/** 색 칩: 색 + 모양 + 이름 (색 고르기, 지금 색 표시에 사용) */
export function ColorShapeIcon({ color, size = 18 }: { color: CardColor; size?: number }) {
  const info = COLOR_INFO[color];
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} aria-hidden="true" className="lc-shape-icon">
      <circle cx={10} cy={10} r={9.5} fill={info.main} stroke={info.dark} strokeWidth={1} />
      {shapeElement(info.shape, 10, 10, 5.5, '#fff')}
    </svg>
  );
}
