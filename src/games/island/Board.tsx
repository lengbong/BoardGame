import { memo, useState, type KeyboardEvent, type RefObject } from 'react';
import { SEAT_COLORS } from '../common/players';
import { HallShape, HouseShape, LighthouseShape, NumberToken, ResourceGlyph, SEAT_SHAPES, TERRAIN_FILL, TerrainArt } from './Art';
import { CORNERS, EDGES, HEXES, HEX_SIZE, VIEW, hexPoints } from './board';
import { BUILD_INFO, RES_INFO, TERRAIN_INFO, playerName, usedNumbers } from './rules';
import type { BuildKind, IslandState } from './types';

/** 장터 가판대 자리 (오른쪽 위 바다) */
export const MARKET_SPOT = { x: VIEW.x + VIEW.w - 168, y: VIEW.y + 68 };
export const MARKET_SLOT_GAP = 46;
export function marketSlotPos(slot: number): { x: number; y: number } {
  return { x: MARKET_SPOT.x + (slot - 1.5) * MARKET_SLOT_GAP, y: MARKET_SPOT.y + 8 };
}
/** 주사위 쟁반 자리 (왼쪽 아래 바다) */
export const DICE_SPOT = { x: VIEW.x + 160, y: VIEW.y + VIEW.h - 58 };

export interface Placing {
  kind: BuildKind;
  spots: number[];
  recommended: number | null;
  /** 초보 도움: 자리가 크게 반짝인다 */
  strong: boolean;
}

interface BoardProps {
  state: IslandState;
  placing: Placing | null;
  /** 지금 반짝이는 땅 칸 (주사위와 같은 숫자) */
  hot: ReadonlySet<number>;
  /** 골라 쓰는 주사위: 이 눈을 고르면 자원을 낼 칸 (미리 보기) */
  preview: ReadonlySet<number>;
  /** 장터에서 방금 바뀐 칸 */
  marketFlash: number | null;
  /** 놓을 자리를 골랐을 때 */
  onPick: (at: number) => void;
  svgRef: RefObject<SVGSVGElement | null>;
  /** 누구 색으로 미리 보기를 그릴지 */
  viewer: number;
}

const ROAD_DASH: Record<number, string | null> = { 0: null, 1: '6 5', 2: '0.1 5.5', 3: '11 3 2 3' };

/** 바다 물결 줄 (섬 아래에 깔리므로 섬 위치는 신경 쓰지 않는다) */
const WAVES = Array.from({ length: 14 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 91.7 + n * 12.3) * 9999;
    return x - Math.floor(x);
  };
  return { x: VIEW.x + r(1) * VIEW.w, y: VIEW.y + 14 + r(2) * (VIEW.h - 28), w: 22 + r(3) * 18, delay: r(4) * 4 };
});

function roadEnds(e: number, trim = 9) {
  const edge = EDGES[e];
  const a = CORNERS[edge.a];
  const b = CORNERS[edge.b];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  return { x1: a.x + ux * trim, y1: a.y + uy * trim, x2: b.x - ux * trim, y2: b.y - uy * trim };
}

function hexLabel(state: IslandState, h: number): string {
  const t = state.terrain[h];
  const info = TERRAIN_INFO[t];
  return info.res ? `${info.name} ${state.numbers[h]} (${RES_INFO[info.res].name})` : `${info.name} (자원 없음)`;
}

function cornerLabel(state: IslandState, c: number): string {
  const parts = CORNERS[c].hexes.map((h) => hexLabel(state, h));
  return `${parts.join(', ')}${CORNERS[c].coastal ? ', 바닷가' : ''}`;
}

/** 장터 가판대 */
function MarketStall({ market, flash }: { market: IslandState['market']; flash: number | null }) {
  const { x, y } = MARKET_SPOT;
  const w = MARKET_SLOT_GAP * 4 + 22;
  return (
    <g className="is-stall" aria-label={`장터: ${market.map((r) => RES_INFO[r].name).join(', ')}`} role="img">
      {/* 나무 다리 기둥 */}
      {[-w / 2 + 14, w / 2 - 14].map((px) => (
        <rect key={px} x={x + px - 3} y={y + 22} width={6} height={22} rx={2} fill="#8a5a33" />
      ))}
      <rect x={x - w / 2} y={y - 14} width={w} height={44} rx={10} fill="#c98f58" stroke="#7a4a24" strokeWidth={2} />
      <path d={`M${x - w / 2 + 6} ${y + 2} H${x + w / 2 - 6}`} stroke="#a8713f" strokeWidth={1.2} strokeDasharray="6 5" />
      {/* 줄무늬 차양 */}
      <path
        d={`M${x - w / 2 - 6} ${y - 14} L${x - w / 2 + 8} ${y - 38} H${x + w / 2 - 8} L${x + w / 2 + 6} ${y - 14} Z`}
        fill="#fff6e0"
        stroke="#7a4a24"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {Array.from({ length: 6 }, (_, i) => {
        const x0 = x - w / 2 - 6 + ((w + 12) / 6) * i;
        const x1 = x - w / 2 + 8 + ((w - 16) / 6) * i;
        return <path key={i} d={`M${x0} ${y - 14} L${x1} ${y - 38} H${x1 + (w - 16) / 12} L${x0 + (w + 12) / 12} ${y - 14} Z`} fill="#e86a5a" opacity={0.85} />;
      })}
      <text x={x} y={y - 44} textAnchor="middle" className="is-stall-title">
        🧺 장터
      </text>
      {market.map((r, i) => {
        const p = marketSlotPos(i);
        return (
          <g key={i} className={flash === i ? 'is-stall-flash' : undefined} style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
            <circle cx={p.x} cy={p.y} r={17} fill="#fffaf0" stroke="#7a4a24" strokeWidth={1.6} />
            <g transform={`translate(${p.x - 13} ${p.y - 13}) scale(${26 / 32})`}>
              <ResourceGlyph res={r} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** 작은 돛단배 (꾸밈) */
function Sailboat({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <g className="is-boat">
      <path d="M-18 4 H18 L12 13 H-12 Z" fill="#b5713f" stroke="#6b3f1f" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M0 4 V-26" stroke="#6b3f1f" strokeWidth={1.6} />
      <path d="M1 -25 L16 1 H1 Z" fill="#fffaf0" stroke="#a89a80" strokeWidth={1} strokeLinejoin="round" />
      <path d="M-1 -20 L-12 1 H-1 Z" fill="#ffd166" stroke="#a89a80" strokeWidth={1} strokeLinejoin="round" />
      </g>
    </g>
  );
}

function BoardImpl({ state, placing, hot, preview, marketFlash, onPick, svgRef, viewer }: BoardProps) {
  const [hover, setHover] = useState<number | null>(null);
  const viewerColor = SEAT_COLORS[state.players[viewer]?.seat ?? 0];
  const viewerShape = SEAT_SHAPES[state.players[viewer]?.seat ?? 0];
  const used = usedNumbers(state);
  const spotSet = new Set(placing?.spots ?? []);
  const cornerMode = placing && placing.kind !== 'road';
  const hoverHexes = cornerMode && hover !== null && spotSet.has(hover) ? new Set(CORNERS[hover].hexes) : null;

  const key = (at: number) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onPick(at);
    }
  };

  const piece = (c: number) => {
    const b = state.buildings[c];
    if (!b) return null;
    const color = SEAT_COLORS[state.players[b.owner].seat];
    const shape = SEAT_SHAPES[state.players[b.owner].seat];
    const { x, y } = CORNERS[c];
    return (
      <g key={`b-${c}-${b.type}`} className="is-piece is-pop" style={{ transformOrigin: `${x}px ${y}px` }}>
        <title>{`${playerName(state.players[b.owner])}의 ${b.type === 'hall' ? '마을회관' : '집'}`}</title>
        {b.type === 'hall' ? <HallShape x={x} y={y + 2} color={color.main} dark={color.dark} shape={shape} /> : <HouseShape x={x} y={y + 3} color={color.main} dark={color.dark} shape={shape} />}
      </g>
    );
  };

  return (
    <svg
      ref={svgRef}
      className="is-board"
      viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
      role="group"
      aria-label="섬 판"
      onMouseLeave={() => setHover(null)}
    >
      <defs>
        <radialGradient id="is-sea" cx="45%" cy="40%" r="75%">
          <stop offset="0%" style={{ stopColor: 'var(--is-sea-1)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--is-sea-2)' }} />
        </radialGradient>
        {(Object.keys(TERRAIN_FILL) as (keyof typeof TERRAIN_FILL)[]).map((t) => (
          <linearGradient key={t} id={`is-fill-${t}`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor={TERRAIN_FILL[t][0]} />
            <stop offset="100%" stopColor={TERRAIN_FILL[t][1]} />
          </linearGradient>
        ))}
        {HEXES.map((h) => (
          <clipPath key={h.id} id={`is-clip-${h.id}`}>
            <polygon points={hexPoints(h.x, h.y, 0.96)} />
          </clipPath>
        ))}
        <filter id="is-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 바다 */}
      <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} rx={26} fill="url(#is-sea)" />
      <g className="is-waves" aria-hidden="true">
        {WAVES.map((w, i) => (
          <path
            key={i}
            className="is-wave"
            d={`M${w.x} ${w.y} q${w.w / 4} -5 ${w.w / 2} 0 t${w.w / 2} 0`}
            style={{ stroke: 'var(--is-wave)', animationDelay: `${-w.delay}s` }}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
          />
        ))}
      </g>
      <Sailboat x={VIEW.x + 58} y={VIEW.y + 120} />

      {/* 얕은 물, 하얀 물거품, 모래사장 (원을 겹쳐 손으로 그린 듯한 해안선) */}
      <g aria-hidden="true">
        {HEXES.map((h) => (
          <circle key={h.id} cx={h.x} cy={h.y} r={HEX_SIZE * 1.34} style={{ fill: 'var(--is-shallow)' }} />
        ))}
        {HEXES.map((h) => (
          <circle key={h.id} cx={h.x} cy={h.y} r={HEX_SIZE * 1.17} style={{ fill: 'var(--is-foam)' }} />
        ))}
        {HEXES.map((h) => (
          <circle key={h.id} cx={h.x} cy={h.y} r={HEX_SIZE * 1.11} style={{ fill: 'var(--is-sand)' }} />
        ))}
      </g>

      {/* 땅 칸 */}
      {HEXES.map((h) => {
        const t = state.terrain[h.id];
        const n = state.numbers[h.id];
        const isHot = hot.has(h.id);
        const lit = n > 0 && used.includes(n);
        const pre = preview.has(h.id);
        return (
          <g key={h.id} className={`is-hex${isHot ? ' is-hex-hot' : ''}${hoverHexes?.has(h.id) ? ' is-hex-hover' : ''}`} data-testid={`is-hex-${h.id}`}>
            <title>{hexLabel(state, h.id)}</title>
            <polygon points={hexPoints(h.x, h.y, 0.985)} fill={`url(#is-fill-${t})`} stroke="rgba(90,66,30,0.55)" strokeWidth={2} strokeLinejoin="round" />
            <polygon points={hexPoints(h.x, h.y, 0.94)} transform={`rotate(1.4 ${h.x} ${h.y})`} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={1.2} strokeLinejoin="round" />
            <g clipPath={`url(#is-clip-${h.id})`}>
              <TerrainArt terrain={t} cx={h.x} cy={h.y} variant={h.id} />
            </g>
            {n > 0 && <NumberToken n={n} cx={h.x} cy={h.y} hot={isHot || lit || pre} />}
            {isHot && <polygon className="is-hot-ring" points={hexPoints(h.x, h.y, 0.9)} filter="url(#is-glow)" />}
            {pre && !isHot && <polygon className="is-preview-ring" points={hexPoints(h.x, h.y, 0.9)} />}
          </g>
        );
      })}

      {/* 길 */}
      {state.roads.map((owner, e) => {
        if (owner === null) return null;
        const seat = state.players[owner].seat;
        const c = SEAT_COLORS[seat];
        const p = roadEnds(e);
        const dash = ROAD_DASH[seat];
        return (
          <g key={`r-${e}`} className="is-road is-pop" style={{ transformOrigin: `${EDGES[e].x}px ${EDGES[e].y}px` }}>
            <title>{`${playerName(state.players[owner])}의 길`}</title>
            <line {...p} stroke={c.dark} strokeWidth={11} strokeLinecap="round" />
            <line {...p} stroke={c.main} strokeWidth={7} strokeLinecap="round" />
            {dash && <line {...p} stroke="#fff" strokeWidth={2} strokeDasharray={dash} strokeLinecap="round" opacity={0.9} />}
          </g>
        );
      })}

      {/* 건물과 등대 */}
      {CORNERS.map((c) => piece(c.id))}
      {state.lighthouses.map((c, p) => {
        if (c === null) return null;
        const color = SEAT_COLORS[state.players[p].seat];
        const corner = CORNERS[c];
        const x = corner.x + corner.outX * 24;
        const y = corner.y + corner.outY * 24 + 2;
        return (
          <g key={`l-${p}`} className="is-piece is-pop" style={{ transformOrigin: `${x}px ${y}px` }}>
            <title>{`${playerName(state.players[p])}의 등대`}</title>
            <LighthouseShape x={x} y={y} color={color.main} dark={color.dark} />
          </g>
        );
      })}

      {state.market.length > 0 && <MarketStall market={state.market} flash={marketFlash} />}

      {/* 놓을 자리 */}
      {placing && placing.kind === 'road' && (
        <g className={`is-spots${placing.strong ? ' is-spots-strong' : ''}`}>
          {placing.spots.map((e) => {
            const p = roadEnds(e, 6);
            const on = hover === e;
            return (
              <g
                key={e}
                className={`is-espot${on ? ' is-spot-on' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`길 놓을 자리 ${e + 1}`}
                onClick={() => onPick(e)}
                onKeyDown={key(e)}
                onMouseEnter={() => setHover(e)}
                onFocus={() => setHover(e)}
                onBlur={() => setHover(null)}
                data-testid={`is-edge-${e}`}
              >
                <line {...p} className="is-espot-hit" />
                {on ? (
                  <g opacity={0.75}>
                    <line {...p} stroke={viewerColor.dark} strokeWidth={11} strokeLinecap="round" />
                    <line {...p} stroke={viewerColor.main} strokeWidth={7} strokeLinecap="round" />
                  </g>
                ) : (
                  <line {...p} className="is-espot-mark" />
                )}
              </g>
            );
          })}
        </g>
      )}
      {placing && placing.kind !== 'road' && (
        <g className={`is-spots${placing.strong ? ' is-spots-strong' : ''}`}>
          {placing.spots.map((c) => {
            const { x, y } = CORNERS[c];
            const on = hover === c;
            const ghost = on && placing.kind === 'house';
            return (
              <g
                key={c}
                className={`is-cspot${on ? ' is-spot-on' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${BUILD_INFO[placing.kind].name} 지을 자리: ${cornerLabel(state, c)}`}
                onClick={() => onPick(c)}
                onKeyDown={key(c)}
                onMouseEnter={() => setHover(c)}
                onFocus={() => setHover(c)}
                onBlur={() => setHover(null)}
                data-testid={`is-corner-${c}`}
              >
                <circle cx={x} cy={y} r={17} className="is-cspot-hit" />
                {ghost ? (
                  <g opacity={0.72}>
                    <HouseShape x={x} y={y + 3} color={viewerColor.main} dark={viewerColor.dark} shape={viewerShape} />
                  </g>
                ) : (
                  <circle cx={x} cy={y} r={placing.kind === 'house' ? 9 : 24} className={placing.kind === 'house' ? 'is-cspot-mark' : 'is-cspot-mark is-cspot-ring'} style={{ stroke: viewerColor.main }} />
                )}
              </g>
            );
          })}
        </g>
      )}
      {placing && placing.recommended !== null && placing.spots.includes(placing.recommended) && (
        <g className="is-reco" aria-hidden="true">
          {(() => {
            const at = placing.recommended;
            const pos = placing.kind === 'road' ? { x: EDGES[at].x, y: EDGES[at].y } : { x: CORNERS[at].x, y: CORNERS[at].y };
            const dy = placing.kind === 'road' ? -14 : placing.kind === 'house' ? -22 : -40;
            return (
              <text x={pos.x} y={pos.y + dy} textAnchor="middle" className="is-reco-star">
                ⭐
              </text>
            );
          })()}
        </g>
      )}
    </svg>
  );
}

export const Board = memo(BoardImpl);
