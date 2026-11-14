import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { SEAT_COLORS, type SeatIndex } from '../common/players';
import { keyX, keyY } from './board';
import type { FlagChoice } from './rules';
import { Pennant, SegmentGlow, TileArt } from './TileArt';
import { TILES, rotPt } from './tiles';
import type { Node, Placed, Rot, Side } from './types';

/** 조각 한 칸의 크기 (지도 좌표) */
export const CELL = 100;

export interface Ghost {
  t: number;
  x: number;
  y: number;
  r: Rot;
  ok: boolean;
  mismatches: Side[];
}

export interface Glow {
  id: number;
  nodes: readonly Node[];
  color: string;
  /** complete: 완성 반짝임, final: 끝 점수, preview: 깃발 미리 보기 */
  tone: 'complete' | 'final' | 'preview';
}

export interface Float {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
}

export interface FadingFlag {
  id: number;
  index: number;
  seg: number;
  seat: SeatIndex;
}

interface MapViewProps {
  board: readonly Placed[];
  seats: readonly SeatIndex[];
  frontier: readonly number[];
  spots: ReadonlyMap<number, Rot[]> | null;
  showSpots: boolean;
  /** 사람이 조각을 놓는 중 */
  placing: boolean;
  ghost: Ghost | null;
  pending: number | null;
  /** 방금 놓은 조각 (내려앉는 연출, 놓은 사람 색 테두리) */
  lastIndex: number | null;
  dropIndex: number | null;
  newFlag: number | null;
  flagPick: { index: number; choices: FlagChoice[]; selected: number | null; seat: SeatIndex } | null;
  glows: readonly Glow[];
  floats: readonly Float[];
  fading: readonly FadingFlag[];
  /** 바뀌면 지도를 화면에 맞춘다 */
  fitKey: string | number;
  cameraMs: number;
  onHover: (key: number | null) => void;
  onCell: (key: number) => void;
  onRotate: () => void;
  onFlag: (seg: number) => void;
  onFlagHover: (seg: number | null) => void;
  /** 지도 위에 잠깐 띄우는 알림 (차례 알림) */
  banner: { id: number; text: string; color: string } | null;
}

interface Cam {
  x: number;
  y: number;
  s: number;
}

const MIN_S = 0.22;
const MAX_S = 1.6;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const cellOf = (wx: number, wy: number) => [Math.floor(wx / CELL), Math.floor(wy / CELL)] as const;

/** 지도 좌표에서 조각의 그림 좌표 (돌린 뒤) */
function anchorOf(p: Placed, seg: number): [number, number] {
  const a = rotPt(TILES[p.t].segs[seg].anchor, p.r);
  return [p.x * CELL + a[0], p.y * CELL + a[1]];
}

export function MapView(props: MapViewProps) {
  const { board, frontier, spots, showSpots, placing, ghost, pending, flagPick } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const cam = useRef<Cam>({ x: 50, y: 50, s: 1 });
  const size = useRef({ w: 800, h: 600 });
  const raf = useRef<number | null>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; cx: number; cy: number; moved: boolean } | null>(null);
  const hoverKey = useRef<number | null>(null);
  const userMoved = useRef(false);
  const [scale, setScale] = useState(1);
  const propsRef = useRef(props);
  propsRef.current = props;

  const apply = useCallback(() => {
    const { w, h } = size.current;
    const c = cam.current;
    gRef.current?.setAttribute('transform', `translate(${(w / 2).toFixed(1)} ${(h / 2).toFixed(1)}) scale(${c.s.toFixed(4)}) translate(${(-c.x).toFixed(1)} ${(-c.y).toFixed(1)})`);
  }, []);

  const animateTo = useCallback(
    (target: Cam, ms: number) => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
      const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (ms <= 0 || reduce) {
        cam.current = target;
        apply();
        setScale(target.s);
        return;
      }
      const from = { ...cam.current };
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        const e = ease(k);
        cam.current = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, s: from.s + (target.s - from.s) * e };
        apply();
        if (k < 1) raf.current = requestAnimationFrame(step);
        else {
          raf.current = null;
          setScale(target.s);
        }
      };
      raf.current = requestAnimationFrame(step);
    },
    [apply],
  );

  /** 놓인 조각과 그 둘레 한 칸이 모두 보이게 */
  const fitTarget = useCallback((): Cam => {
    const tiles = propsRef.current.board;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of tiles) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const x0 = (minX - 1) * CELL;
    const x1 = (maxX + 2) * CELL;
    const y0 = (minY - 1) * CELL;
    const y1 = (maxY + 2) * CELL;
    const { w, h } = size.current;
    const s = Math.max(MIN_S, Math.min(1.15, Math.min((w - 24) / (x1 - x0), (h - 24) / (y1 - y0))));
    return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, s };
  }, []);

  const fit = useCallback(
    (ms: number) => {
      userMoved.current = false;
      animateTo(fitTarget(), ms);
    },
    [animateTo, fitTarget],
  );

  // 크기 재기
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      size.current = { w: el.clientWidth, h: el.clientHeight };
      if (!userMoved.current) {
        cam.current = fitTarget();
        setScale(cam.current.s);
      }
      apply();
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [apply, fitTarget]);

  // 조각을 놓을 때마다 지도를 맞춘다
  const firstFit = useRef(true);
  useEffect(() => {
    if (firstFit.current) {
      firstFit.current = false;
      return;
    }
    fit(propsRef.current.cameraMs);
  }, [props.fitKey, fit]);

  useEffect(() => () => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
  }, []);

  const zoomAt = useCallback(
    (factor: number, sx?: number, sy?: number) => {
      const { w, h } = size.current;
      const c = cam.current;
      const s = Math.max(MIN_S, Math.min(MAX_S, c.s * factor));
      const px = sx ?? w / 2;
      const py = sy ?? h / 2;
      // 가리킨 곳이 그대로 있게
      const wx = c.x + (px - w / 2) / c.s;
      const wy = c.y + (py - h / 2) / c.s;
      userMoved.current = true;
      animateTo({ x: wx - (px - w / 2) / s, y: wy - (py - h / 2) / s, s }, sx === undefined ? 160 : 0);
    },
    [animateTo],
  );

  // 휠로 확대·축소 (페이지가 같이 굴러가지 않게 passive: false)
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // 키보드 +/−/0 (게임 화면이 보낸다)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') zoomAt(1.25);
      else if (e.key === '-' || e.key === '_') zoomAt(1 / 1.25);
      else if (e.key === '0') fit(propsRef.current.cameraMs || 200);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomAt, fit]);

  const toWorld = (clientX: number, clientY: number): [number, number] => {
    const el = wrapRef.current!;
    const r = el.getBoundingClientRect();
    const { w, h } = size.current;
    const c = cam.current;
    return [c.x + (clientX - r.left - w / 2) / c.s, c.y + (clientY - r.top - h / 2) / c.s];
  };

  const flagScale = Math.max(1, Math.min(1.9, 0.8 / scale));

  /** 가리킨 곳에서 가장 가까운 깃발 자리 */
  const pickAt = (wx: number, wy: number): number | null => {
    const p = propsRef.current;
    if (!p.flagPick) return null;
    const tile = p.board[p.flagPick.index];
    let best: { seg: number; d: number } | null = null;
    for (const c of p.flagPick.choices) {
      if (!c.ok) continue;
      const [ax, ay] = anchorOf(tile, c.seg);
      // 깃발 천은 기둥 위쪽에 있다
      const dist = Math.min(Math.hypot(wx - ax, wy - ay), Math.hypot(wx - (ax + 9 * flagScale), wy - (ay - 22 * flagScale)));
      if (dist < 20 * flagScale && (!best || dist < best.d)) best = { seg: c.seg, d: dist };
    }
    return best ? best.seg : null;
  };
  const hoverPick = useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, cx: cam.current.x, cy: cam.current.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) > 5) {
        d.moved = true;
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        if (raf.current !== null) cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      if (d.moved) {
        userMoved.current = true;
        cam.current = { ...cam.current, x: d.cx - dx / cam.current.s, y: d.cy - dy / cam.current.s };
        apply();
        return;
      }
    }
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    if (propsRef.current.flagPick) {
      const seg = pickAt(wx, wy);
      if (seg !== hoverPick.current) {
        hoverPick.current = seg;
        propsRef.current.onFlagHover(seg);
      }
    }
    const [x, y] = cellOf(wx, wy);
    const key = (x + 512) * 1024 + (y + 512);
    if (hoverKey.current !== key) {
      hoverKey.current = key;
      propsRef.current.onHover(key);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || d.moved) return;
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    const p = propsRef.current;
    if (p.flagPick) {
      const seg = pickAt(wx, wy);
      if (seg !== null) p.onFlag(seg);
      return;
    }
    const [x, y] = cellOf(wx, wy);
    p.onCell((x + 512) * 1024 + (y + 512));
  };
  const onPointerLeave = () => {
    if (drag.current?.moved) return;
    hoverKey.current = null;
    propsRef.current.onHover(null);
  };

  const flagged = board.map((p, i) => ({ p, i })).filter(({ p }) => p.flag !== null);
  const last = props.lastIndex !== null ? board[props.lastIndex] : null;
  const lastSeat = last && last.by !== null ? props.seats[last.by] : null;
  const textSize = Math.max(26, Math.min(64, 24 / scale));

  return (
    <div
      ref={wrapRef}
      className={`vl-map${placing ? ' vl-map-placing' : ''}${flagPick ? ' vl-map-flagging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      onPointerLeave={onPointerLeave}
      onContextMenu={(e) => {
        e.preventDefault();
        props.onRotate();
      }}
      data-testid="vl-map"
    >
      <svg className="vl-map-svg" role="img" aria-label={`마을 지도: 조각 ${board.length}장`}>
        <g ref={gRef}>
          {/* 빈 자리 (놓을 수 있는 곳은 반짝) */}
          {placing &&
            frontier.map((k) => {
              const x = keyX(k);
              const y = keyY(k);
              const ok = spots?.has(k) ?? false;
              const cls = ['vl-slot', ok && showSpots && 'vl-slot-ok', pending === k && 'vl-slot-pending'].filter(Boolean).join(' ');
              return <rect key={k} x={x * CELL + 3} y={y * CELL + 3} width={CELL - 6} height={CELL - 6} rx={10} className={cls} data-testid={ok ? 'vl-spot' : undefined} />;
            })}

          {/* 조각 그림자 (종이 위에 나무 조각을 올린 느낌) */}
          {board.map((p, i) => (
            <rect key={`s${i}`} x={p.x * CELL + 3} y={p.y * CELL + 5} width={CELL} height={CELL} rx={3} className="vl-tile-shadow" />
          ))}
          {board.map((p, i) => (
            <g key={i} transform={`translate(${p.x * CELL} ${p.y * CELL})`} className={i === props.dropIndex ? 'vl-tile vl-drop' : 'vl-tile'}>
              <TileArt t={p.t} r={p.r} />
            </g>
          ))}
          {last && lastSeat !== null && (
            <rect
              x={last.x * CELL + 2}
              y={last.y * CELL + 2}
              width={CELL - 4}
              height={CELL - 4}
              rx={6}
              className="vl-last"
              style={{ stroke: SEAT_COLORS[lastSeat].main }}
            />
          )}

          {props.glows.map((g) => (
            <g key={g.id} className={`vl-glow vl-glow-${g.tone}`} style={{ '--glow': g.color } as CSSProperties}>
              {g.nodes.map(([i, s]) => {
                const p = board[i];
                if (!p) return null;
                const seg = TILES[p.t].segs[s];
                return (
                  <g key={`${i}-${s}`} transform={`translate(${p.x * CELL} ${p.y * CELL})`} clipPath="url(#vl-clip)">
                    <g transform={p.r ? `rotate(${p.r * 90} 50 50)` : undefined}>
                      <SegmentGlow seg={seg} className={seg.kind === 'paddy' ? 'vl-glow-area' : 'vl-glow-line'} />
                    </g>
                  </g>
                );
              })}
            </g>
          ))}

          {flagged.map(({ p, i }) => {
            const [ax, ay] = anchorOf(p, p.flag!.seg);
            return (
              <g key={`f${i}`} transform={`translate(${ax} ${ay})`} className={i === props.newFlag ? 'vl-flag vl-flag-new' : 'vl-flag'}>
                <Pennant seat={props.seats[p.flag!.player]} scale={flagScale} />
              </g>
            );
          })}
          {props.fading.map((f) => {
            const p = board[f.index];
            if (!p) return null;
            const [ax, ay] = anchorOf(p, f.seg);
            return (
              <g key={`x${f.id}`} transform={`translate(${ax} ${ay})`} className="vl-flag-going">
                <Pennant seat={f.seat} scale={flagScale} />
              </g>
            );
          })}

          {ghost && (
            <g transform={`translate(${ghost.x * CELL} ${ghost.y * CELL})`} className={`vl-ghost ${ghost.ok ? 'vl-ghost-ok' : 'vl-ghost-bad'}`} data-testid="vl-ghost">
              <g opacity={ghost.ok ? 0.88 : 0.55}>
                <TileArt t={ghost.t} r={ghost.r} />
              </g>
              <rect x={1.5} y={1.5} width={97} height={97} rx={4} className="vl-ghost-frame" />
              {ghost.mismatches.map((s) => {
                const pts = [
                  [50, 4],
                  [96, 50],
                  [50, 96],
                  [4, 50],
                ][s];
                return (
                  <g key={s} transform={`translate(${pts[0]} ${pts[1]})`} className="vl-mismatch">
                    <circle r={9} />
                    <path d="M-4 -4 L4 4 M4 -4 L-4 4" />
                  </g>
                );
              })}
            </g>
          )}

          {flagPick &&
            flagPick.choices
              .filter((c) => c.ok)
              .map((c) => {
                const [ax, ay] = anchorOf(board[flagPick.index], c.seg);
                const on = flagPick.selected === c.seg;
                return (
                  <g key={`pick${c.seg}`} transform={`translate(${ax} ${ay})`} className={`vl-pick${on ? ' vl-pick-on' : ''}`} data-testid={`vl-pick-${c.seg}`}>
                    <circle cx={0} cy={-6} r={15 * flagScale} className="vl-pick-ring" />
                    <Pennant seat={flagPick.seat} scale={flagScale} />
                  </g>
                );
              })}

          {props.floats.map((f) => (
            <text key={f.id} x={f.x} y={f.y} className="vl-float" style={{ fill: f.color, fontSize: textSize }}>
              {f.text}
            </text>
          ))}
        </g>
      </svg>
      {props.banner && (
        <div key={props.banner.id} className="vl-banner" style={{ '--seat': props.banner.color } as CSSProperties} aria-hidden="true">
          {props.banner.text}
        </div>
      )}
      <div className="vl-zoom" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="btn btn-small" onClick={() => zoomAt(1.25)} aria-label="크게 보기" title="크게 보기 (+)">
          ＋
        </button>
        <button type="button" className="btn btn-small" onClick={() => zoomAt(1 / 1.25)} aria-label="작게 보기" title="작게 보기 (−)">
          －
        </button>
        <button type="button" className="btn btn-small" onClick={() => fit(props.cameraMs || 200)} aria-label="지도 전체 보기" title="지도 전체 보기 (0)" data-testid="vl-fit">
          ⤢
        </button>
      </div>
    </div>
  );
}
