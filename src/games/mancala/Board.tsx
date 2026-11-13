import { memo, useId, type CSSProperties, type ReactNode } from 'react';
import type { Callout, Flyer, Hand } from './animation';
import {
  COLS,
  PIT_R,
  ROW_BOTTOM,
  ROW_TOP,
  SEED_COLORS,
  SEED_R,
  STORE_RX,
  STORE_RY,
  STORE_Y,
  VIEW_H,
  VIEW_W,
  cellCenter,
  hash01,
  isTopRow,
  maxDrawn,
  seedColorIndex,
  seedSpot,
  type Point,
} from './layout';
import { CELLS, isStore, ownerOf, pitNumber, storeOf } from './rules';
import { SIDE_INFO } from './sides';
import type { LastMove, MoveResult, Side } from './types';

/* ------------------------------------------------------------------ 나무판 */

/** 나뭇결: 고정된 의사 난수로 그린 물결선 (다시 그려도 똑같다) */
const GRAIN: { d: string; w: number; o: number }[] = Array.from({ length: 34 }, (_, j) => {
  const y0 = 18 + j * 12.4 + (hash01(j, 1) - 0.5) * 6;
  const a1 = 2 + hash01(j, 2) * 5;
  const a2 = 1 + hash01(j, 3) * 3;
  const f1 = 0.004 + hash01(j, 4) * 0.004;
  const f2 = 0.011 + hash01(j, 5) * 0.01;
  const p1 = hash01(j, 6) * 6.28;
  const p2 = hash01(j, 7) * 6.28;
  const pts: string[] = [];
  for (let x = 0; x <= VIEW_W; x += 25) {
    // 옹이 둘레에서 결이 휘어진다
    const knot = 26 * Math.exp(-(((x - 640) / 70) ** 2 + ((y0 - 230) / 40) ** 2)) - 18 * Math.exp(-(((x - 300) / 60) ** 2 + ((y0 - 120) / 30) ** 2));
    const y = y0 + a1 * Math.sin(x * f1 + p1) + a2 * Math.sin(x * f2 + p2) + knot;
    pts.push(`${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`);
  }
  return { d: pts.join(' '), w: 0.7 + hash01(j, 8) * 1.8, o: 0.1 + hash01(j, 9) * 0.22 };
});

function WoodDefs({ p }: { p: string }) {
  return (
    <>
      <linearGradient id={`${p}-wood`} x1="0" y1="0" x2="0.15" y2="1">
        <stop offset="0" stopColor="#d4975a" />
        <stop offset="0.45" stopColor="#bf7f43" />
        <stop offset="1" stopColor="#9e6130" />
      </linearGradient>
      <linearGradient id={`${p}-frame`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#8a5428" />
        <stop offset="1" stopColor="#5b3214" />
      </linearGradient>
      <radialGradient id={`${p}-hollow`} cx="50%" cy="60%" r="62%" fx="50%" fy="74%">
        <stop offset="0" stopColor="#8d5729" />
        <stop offset="0.55" stopColor="#6a3d18" />
        <stop offset="1" stopColor="#3d210b" />
      </radialGradient>
      <linearGradient id={`${p}-rim`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3e220c" />
        <stop offset="0.5" stopColor="#7b4a22" />
        <stop offset="1" stopColor="#f0c08a" />
      </linearGradient>
      <linearGradient id={`${p}-inshade`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1e0f03" stopOpacity="0.55" />
        <stop offset="0.45" stopColor="#1e0f03" stopOpacity="0" />
      </linearGradient>
      <clipPath id={`${p}-clip`}>
        <rect x="14" y="14" width={VIEW_W - 28} height={VIEW_H - 28} rx="96" />
      </clipPath>
      {SEED_COLORS.map((c, i) => (
        <radialGradient key={i} id={`${p}-s${i}`} cx="38%" cy="32%" r="78%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.18" stopColor={c.main} />
          <stop offset="0.7" stopColor={c.main} />
          <stop offset="1" stopColor={c.dark} />
        </radialGradient>
      ))}
    </>
  );
}

function Wood({ p, bottom }: { p: string; bottom: Side }) {
  const top = bottom === 0 ? 1 : 0;
  return (
    <g className="mc-wood" aria-hidden="true">
      <rect x="4" y="4" width={VIEW_W - 8} height={VIEW_H - 8} rx="104" fill={`url(#${p}-frame)`} />
      <rect x="14" y="14" width={VIEW_W - 28} height={VIEW_H - 28} rx="96" fill={`url(#${p}-wood)`} />
      <g clipPath={`url(#${p}-clip)`}>
        {GRAIN.map((g, i) => (
          <path key={i} d={g.d} fill="none" stroke="#6b3a14" strokeWidth={g.w} opacity={g.o} />
        ))}
        <ellipse cx="640" cy="232" rx="13" ry="7" fill="none" stroke="#6b3a14" strokeWidth="1.6" opacity="0.35" />
        <ellipse cx="640" cy="232" rx="5" ry="2.6" fill="#6b3a14" opacity="0.4" />
        {/* 위쪽에서 비치는 빛 */}
        <rect x="14" y="14" width={VIEW_W - 28} height="140" fill="#fff3dd" opacity="0.07" />
        {/* 편마다 판 가장자리에 색 띠 */}
        <rect x="150" y={VIEW_H - 30} width={VIEW_W - 300} height="5" rx="2.5" fill={SIDE_INFO[bottom].main} opacity="0.85" />
        <rect x="150" y="25" width={VIEW_W - 300} height="5" rx="2.5" fill={SIDE_INFO[top].main} opacity="0.85" />
      </g>
      <rect x="15.5" y="15.5" width={VIEW_W - 31} height={VIEW_H - 31} rx="94.5" fill="none" stroke="#f3cf9f" strokeOpacity="0.45" strokeWidth="1.5" />
      {/* 가운데 장식 홈 */}
      <path d={`M ${COLS[0] - 20} ${(ROW_TOP + ROW_BOTTOM) / 2} H ${COLS[5] + 20}`} stroke="#5b3214" strokeOpacity="0.25" strokeWidth="3" strokeLinecap="round" />
      <path d={`M ${COLS[0] - 20} ${(ROW_TOP + ROW_BOTTOM) / 2 + 2} H ${COLS[5] + 20}`} stroke="#f3cf9f" strokeOpacity="0.25" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

/** 파인 구멍 모양 (구멍은 원, 창고는 길쭉한 캡슐) */
function Hollow({ p, cell, center }: { p: string; cell: number; center: Point }) {
  if (isStore(cell)) {
    const x = center.x - STORE_RX;
    const y = center.y - STORE_RY;
    return (
      <>
        <rect x={x - 2} y={y - 2} width={STORE_RX * 2 + 4} height={STORE_RY * 2 + 4} rx={STORE_RX + 2} fill="none" stroke={`url(#${p}-rim)`} strokeWidth="4" />
        <rect x={x} y={y} width={STORE_RX * 2} height={STORE_RY * 2} rx={STORE_RX} fill={`url(#${p}-hollow)`} />
        <rect x={x} y={y} width={STORE_RX * 2} height={STORE_RY * 2} rx={STORE_RX} fill={`url(#${p}-inshade)`} />
      </>
    );
  }
  return (
    <>
      <circle cx={center.x} cy={center.y} r={PIT_R + 2} fill="none" stroke={`url(#${p}-rim)`} strokeWidth="4" />
      <circle cx={center.x} cy={center.y} r={PIT_R} fill={`url(#${p}-hollow)`} />
      <circle cx={center.x} cy={center.y} r={PIT_R} fill={`url(#${p}-inshade)`} />
    </>
  );
}

/** 칸 둘레의 고리 (반짝임·미리 보기·마지막 수 표시) */
function Ring({ cell, center, pad, className, style }: { cell: number; center: Point; pad: number; className: string; style?: CSSProperties }) {
  if (isStore(cell)) {
    return (
      <rect
        className={className}
        style={style}
        x={center.x - STORE_RX - pad}
        y={center.y - STORE_RY - pad}
        width={(STORE_RX + pad) * 2}
        height={(STORE_RY + pad) * 2}
        rx={STORE_RX + pad}
      />
    );
  }
  return <circle className={className} style={style} cx={center.x} cy={center.y} r={PIT_R + pad} />;
}

/* ------------------------------------------------------------------ 씨앗 */

function Seed({ p, id, x, y, rot, size = 1 }: { p: string; id: number; x: number; y: number; rot: number; size?: number }) {
  const ci = seedColorIndex(id);
  const rx = SEED_R * size;
  const ry = SEED_R * 0.86 * size;
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
      <g className="mc-seed">
        <ellipse cx={1.6 * size} cy={3 * size} rx={rx * 0.95} ry={ry * 0.85} fill="#1e0d02" opacity="0.38" />
        <ellipse rx={rx} ry={ry} transform={`rotate(${rot.toFixed(0)})`} fill={`url(#${p}-s${ci})`} stroke={SEED_COLORS[ci].dark} strokeWidth="0.8" />
        <ellipse cx={-3.1 * size} cy={-3.3 * size} rx={3 * size} ry={1.7 * size} transform={`rotate(-35 ${-3.1 * size} ${-3.3 * size})`} fill="#fff" opacity="0.7" />
      </g>
    </g>
  );
}

interface CellSeedsProps {
  p: string;
  cell: number;
  ids: number[];
  center: Point;
}

const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** 한 칸의 씨앗 더미. 씨앗 목록이 같으면 다시 그리지 않는다. */
const CellSeeds = memo(
  function CellSeeds({ p, cell, ids, center }: CellSeedsProps) {
    const shown = ids.slice(0, maxDrawn(cell));
    return (
      <g transform={`translate(${center.x} ${center.y})`}>
        {shown.map((id, slot) => {
          const s = seedSpot(cell, slot);
          return <Seed key={id} p={p} id={id} x={s.x} y={s.y} rot={s.rot} />;
        })}
      </g>
    );
  },
  (a, b) => a.p === b.p && a.cell === b.cell && a.center.x === b.center.x && a.center.y === b.center.y && sameIds(a.ids, b.ids),
);

/** 손에 쥔 씨앗 묶음 (한 알씩 떨어뜨리며 칸을 옮겨 간다) */
function HandGroup({ p, hand, bottom }: { p: string; hand: Hand; bottom: Side }) {
  const from = cellCenter(hand.from, bottom);
  const to = cellCenter(hand.at, bottom);
  const lifting = hand.key === 0;
  const style = {
    '--fx': `${from.x}px`,
    '--fy': `${from.y}px`,
    '--tx': `${to.x}px`,
    '--ty': `${to.y}px`,
    '--d': `${Math.max(60, hand.dur)}ms`,
  } as CSSProperties;
  const shown = hand.ids.slice(0, 10);
  return (
    <g className={`mc-hand${lifting ? ' mc-hand-lift' : ''}`} style={style}>
      <ellipse cx="2" cy="10" rx={13 + Math.min(10, shown.length) * 1.3} ry="7" fill="#1e0d02" opacity="0.22" />
      <g className="mc-hand-hop">
        {shown.map((id, k) => {
          const a = k * 2.4 + 0.6;
          const r = k === 0 ? 0 : 7 * Math.sqrt(k);
          return <Seed key={id} p={p} id={id} x={Math.cos(a) * r} y={Math.sin(a) * r * 0.8} rot={k * 47} size={1.05} />;
        })}
        {hand.ids.length > 1 && (
          <g transform="translate(24 -22)">
            <rect x="-16" y="-12" width="32" height="24" rx="12" className="mc-hand-badge" />
            <text y="5" textAnchor="middle" className="mc-hand-badge-text">
              {hand.ids.length}
            </text>
          </g>
        )}
      </g>
    </g>
  );
}

function FlyerSeed({ p, f, bottom }: { p: string; f: Flyer; bottom: Side }) {
  const a = cellCenter(f.from, bottom);
  const b = cellCenter(f.to, bottom);
  const sa = seedSpot(f.from, f.fromSlot);
  const sb = seedSpot(f.to, f.toSlot);
  const style = {
    '--fx': `${a.x + sa.x}px`,
    '--fy': `${a.y + sa.y}px`,
    '--tx': `${b.x + sb.x}px`,
    '--ty': `${b.y + sb.y}px`,
    '--d': `${f.dur}ms`,
    '--delay': `${f.delay}ms`,
  } as CSSProperties;
  return (
    <g className="mc-fly" style={style}>
      <g className="mc-fly-hop">
        <Seed p={p} id={f.seed} x={0} y={0} rot={sb.rot} />
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ 숫자 배지 */

function badgePos(cell: number, bottom: Side): Point {
  const c = cellCenter(cell, bottom);
  if (isStore(cell)) return { x: c.x, y: ownerOf(cell) === bottom ? VIEW_H - 40 : 40 };
  return { x: c.x, y: isTopRow(cell, bottom) ? ROW_TOP - PIT_R - 20 : ROW_BOTTOM + PIT_R + 20 };
}

function Badge({ cell, bottom, count, hot }: { cell: number; bottom: Side; count: number; hot: boolean }) {
  const pos = badgePos(cell, bottom);
  const store = isStore(cell);
  const w = store ? 46 : count >= 10 ? 34 : 28;
  const h = store ? 28 : 24;
  return (
    <g className={`mc-badge${store ? ' mc-badge-store' : ''}${hot ? ' mc-badge-hot' : ''}${count === 0 ? ' mc-badge-zero' : ''}`} transform={`translate(${pos.x} ${pos.y})`}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} />
      <text y={store ? 6.5 : 5.5} textAnchor="middle">
        {count}
      </text>
    </g>
  );
}

/* ------------------------------------------------------------------ 판 */

/** 글자 폭 어림: 한글은 글자 크기만큼, 나머지는 그 절반쯤 */
function textWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) w += /[\u3131-\uD79D]/.test(ch) ? size : ch === ' ' ? size * 0.3 : size * 0.6;
  return w;
}

export interface BoardProps {
  lists: number[][];
  bottom: Side;
  /** 지금 차례인 편 (끝났으면 null) */
  current: Side | null;
  playable: ReadonlySet<number>;
  /** 마우스·키보드로 고르고 있는 구멍 */
  focus: number | null;
  /** 도움말: focus 구멍을 골랐을 때의 결과 */
  preview: MoveResult | null;
  lastMove: LastMove | null;
  hand: Hand | null;
  flyers: Flyer[];
  callout: Callout | null;
  /** 1~6 숫자 단축키를 보여 줄 편 */
  keySide: Side | null;
  names: [string, string];
  onPit: (pit: number) => void;
  onHover: (pit: number | null) => void;
  onFocusPit: (pit: number | null) => void;
}

function previewLabel(preview: MoveResult): string {
  if (preview.gameOver) return '여기서 끝!';
  if (preview.extra) return '한 번 더!';
  if (preview.capture) return `가져와요 +${preview.capture.count}`;
  return '마지막 씨앗';
}

export function Board(props: BoardProps) {
  const { lists, bottom, current, playable, focus, preview, lastMove, hand, flyers, callout, keySide, names } = props;
  const p = useId().replace(/:/g, '');
  const cells = Array.from({ length: CELLS }, (_, i) => i);
  const centers = cells.map((i) => cellCenter(i, bottom));
  const pits = cells.filter((i) => !isStore(i));
  const stores = [storeOf(0), storeOf(1)];

  const pitLabel = (i: number) => {
    const side = ownerOf(i);
    const n = lists[i].length;
    return `${names[side]} ${pitNumber(i)}번 구멍, 씨앗 ${n}개${playable.has(i) ? ' — 눌러서 뿌리기' : ''}`;
  };

  let flag: ReactNode = null;
  if (preview && focus !== null && current !== null) {
    const target = preview.last;
    const c = centers[target];
    const label = previewLabel(preview);
    // 구멍이면 가운데 홈 쪽에(숫자 단축키를 가리지 않게), 창고면 창고 한가운데에 띄운다.
    const keysTop = keySide !== null && keySide !== bottom;
    const keysBottom = keySide === bottom;
    const fy = isStore(target) ? c.y : isTopRow(target, bottom) ? (keysTop ? 228 : 198) : keysBottom ? 212 : 242;
    const fx = Math.min(VIEW_W - 70, Math.max(70, c.x));
    const w = textWidth(label, 17) + 28;
    flag = (
      <g className={`mc-flag${preview.extra ? ' mc-flag-extra' : preview.capture ? ' mc-flag-capture' : ''}`} transform={`translate(${fx} ${fy})`}>
        <rect x={-w / 2} y="-15" width={w} height="30" rx="15" />
        <text y="6" textAnchor="middle">
          {label}
        </text>
      </g>
    );
  }

  const calloutPos = (c: Callout): Point => {
    if (c.cell < 0) return { x: VIEW_W / 2, y: STORE_Y };
    const s = centers[c.cell];
    return { x: s.x < VIEW_W / 2 ? 260 : VIEW_W - 260, y: STORE_Y - 6 };
  };

  return (
    <svg className="mc-board" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="group" aria-label="만칼라 판" data-testid="mc-board">
      <defs>
        <WoodDefs p={p} />
      </defs>
      <Wood p={p} bottom={bottom} />

      {/* 창고 */}
      {stores.map((i) => {
        const side = ownerOf(i);
        const iconY = side === bottom ? 40 : VIEW_H - 40;
        return (
          <g key={i} className="mc-store" role="img" aria-label={`${names[side]} 창고, 씨앗 ${lists[i].length}개`}>
            <Hollow p={p} cell={i} center={centers[i]} />
            <g transform={`translate(${centers[i].x} ${iconY})`} className="mc-store-mark">
              <circle r="15" fill={SIDE_INFO[side].main} stroke="#3e220c" strokeOpacity="0.4" strokeWidth="1.5" />
              <text y="6" textAnchor="middle" className="mc-store-mark-text">
                {SIDE_INFO[side].mark}
              </text>
            </g>
          </g>
        );
      })}

      {/* 구멍 (누를 수 있는 곳) */}
      {pits.map((i) => {
        const can = playable.has(i);
        const isFocus = focus === i && can;
        return (
          <g
            key={i}
            className={`mc-pit${can ? ' mc-pit-playable' : ''}${isFocus ? ' mc-pit-focus' : ''}`}
            role="button"
            tabIndex={can ? 0 : -1}
            aria-label={pitLabel(i)}
            aria-disabled={!can}
            data-pit={i}
            data-testid={`mc-pit-${i}`}
            onClick={() => props.onPit(i)}
            onMouseEnter={() => props.onHover(i)}
            onMouseLeave={() => props.onHover(null)}
            onFocus={() => props.onFocusPit(i)}
            onBlur={() => props.onFocusPit(null)}
          >
            <circle cx={centers[i].x} cy={centers[i].y} r={PIT_R + 8} fill="transparent" />
            <Hollow p={p} cell={i} center={centers[i]} />
            {can && <Ring cell={i} center={centers[i]} pad={6} className="mc-ring-playable" />}
          </g>
        );
      })}

      {/* 마지막 수 표시: 처음 구멍(점선)과 마지막 씨앗이 떨어진 칸 */}
      {lastMove && !hand && (
        <g className="mc-last" aria-hidden="true">
          <Ring cell={lastMove.pit} center={centers[lastMove.pit]} pad={9} className="mc-ring-origin" />
          {!lastMove.capture && <Ring cell={lastMove.last} center={centers[lastMove.last]} pad={9} className="mc-ring-landing" />}
        </g>
      )}

      {/* 씨앗 */}
      <g className="mc-seeds" aria-hidden="true">
        {cells.map((i) => (
          <CellSeeds key={i} p={p} cell={i} ids={lists[i]} center={centers[i]} />
        ))}
      </g>

      {/* 도움말: 마지막 씨앗이 떨어질 곳 */}
      {preview && focus !== null && (
        <g className="mc-preview" aria-hidden="true">
          {preview.path.slice(0, -1).map((cell, k) => {
            const c = centers[cell];
            const o = isStore(cell) ? { x: 0, y: STORE_RY - 22 } : { x: 0, y: isTopRow(cell, bottom) ? -PIT_R + 10 : PIT_R - 10 };
            return <circle key={k} className="mc-path-dot" cx={c.x + o.x + (k >= 13 ? 8 : 0)} cy={c.y + o.y} r="4.5" />;
          })}
          <Ring cell={preview.last} center={centers[preview.last]} pad={8} className={`mc-ring-target${preview.extra ? ' mc-ring-extra' : ''}`} />
          {preview.capture && <Ring cell={preview.capture.opposite} center={centers[preview.capture.opposite]} pad={8} className="mc-ring-capture" />}
          {flag}
        </g>
      )}

      {/* 숫자 배지 */}
      <g aria-hidden="true">
        {cells.map((i) => (
          <Badge key={i} cell={i} bottom={bottom} count={lists[i].length} hot={playable.has(i)} />
        ))}
      </g>

      {/* 숫자 단축키 */}
      {keySide !== null && (
        <g className="mc-keys" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((k) => {
            const i = keySide * 7 + k;
            const c = centers[i];
            const y = isTopRow(i, bottom) ? c.y + PIT_R + 17 : c.y - PIT_R - 17;
            const on = playable.has(i);
            return (
              <g key={k} transform={`translate(${c.x} ${y})`} className={on ? 'mc-key' : 'mc-key mc-key-off'}>
                <rect x="-11" y="-11" width="22" height="22" rx="5" />
                <text y="5" textAnchor="middle">
                  {k + 1}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* 날아가는 씨앗, 손 */}
      <g className="mc-flyers" aria-hidden="true">
        {flyers.map((f) => (
          <FlyerSeed key={f.key} p={p} f={f} bottom={bottom} />
        ))}
      </g>
      {hand && (
        <g aria-hidden="true" className="mc-hand-layer">
          <HandGroup key={hand.key} p={p} hand={hand} bottom={bottom} />
        </g>
      )}

      {callout && (
        <g key={callout.key} className={`mc-callout mc-callout-${callout.kind}`} transform={`translate(${calloutPos(callout).x} ${calloutPos(callout).y})`} aria-hidden="true">
          <g className="mc-callout-pop">
            <rect x={-(textWidth(callout.text, 27) / 2 + 26)} y="-26" width={textWidth(callout.text, 27) + 52} height="52" rx="26" />
            <text y="10" textAnchor="middle">
              {callout.text}
            </text>
          </g>
        </g>
      )}
    </svg>
  );
}

/** 설정 화면 머리에 쓰는 작은 판 그림 (씨앗이 들어 있는 장식용) */
export function HeroBoard() {
  const p = useId().replace(/:/g, '');
  const counts = [4, 4, 4, 4, 4, 4, 3, 4, 4, 4, 4, 4, 4, 2];
  let id = 0;
  const lists = counts.map((n) => Array.from({ length: n }, () => id++));
  return (
    <svg className="mc-hero-board" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
      <defs>
        <WoodDefs p={p} />
      </defs>
      <Wood p={p} bottom={0} />
      {lists.map((ids, i) => {
        const c = cellCenter(i, 0);
        return (
          <g key={i}>
            <Hollow p={p} cell={i} center={c} />
            <CellSeeds p={p} cell={i} ids={ids} center={c} />
          </g>
        );
      })}
    </svg>
  );
}
