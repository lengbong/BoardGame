import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import { DominoFace } from './DominoArt';
import { isDouble } from './dominoes';
import { layoutLine, type GhostSpec, type TilePos } from './layout';
import { lineEnds, sidesFor } from './rules';
import type { DominoState, Side, Tile } from './types';

export interface TableFx {
  id: number;
  text: string;
  tone: 'blocked' | 'win' | 'info';
}

/** 방금 놓은 패가 날아오기 시작한 곳 (탁자 기준 px) */
export interface PlayFrom {
  key: string;
  x: number;
  y: number;
  delay: number;
}

interface DominoTableProps {
  state: DominoState;
  pipColors: boolean;
  feltRef: MutableRefObject<HTMLDivElement | null>;
  /** 사람이 지금 패를 놓을 수 있는지 (다음 자리 표시) */
  interactive: boolean;
  /** 자리에 미리 보여 줄 패 (끝 고르기 중이거나 커서·마우스가 올라간 패) */
  preview: Tile | null;
  /** 두 끝 중 하나를 골라야 하는 중 */
  choosing: boolean;
  activeSide: Side | null;
  onSlot: (side: Side) => void;
  playFrom: PlayFrom | null;
  flyMs: number;
  fx: TableFx | null;
  turnHint: string;
}

const BLANK: GhostSpec = { double: false, entry: null, exit: null };
const SIDES: Side[] = ['left', 'right'];

export const tileKey = (round: number, id: number) => `${round}-${id}`;

function useElementSize(ref: MutableRefObject<HTMLElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** 패 하나를 그 끝에 놓을 때 줄 쪽(entry)과 바깥쪽(exit) 숫자 */
function orient(state: DominoState, tile: Tile, side: Side): { entry: number; exit: number } {
  const ends = lineEnds(state);
  if (!ends) return { entry: tile.a, exit: tile.b };
  const e = side === 'left' ? ends.left : ends.right;
  return { entry: e, exit: tile.a === e ? tile.b : tile.a };
}

export function DominoTable(props: DominoTableProps) {
  const { state, pipColors, feltRef, interactive, preview, choosing, activeSide, playFrom, flyMs, fx, turnHint } = props;
  const { w, h } = useElementSize(feltRef);
  const rots = useRef<{ round: number; map: Map<number, number> }>({ round: state.round, map: new Map() });
  if (rots.current.round !== state.round) rots.current = { round: state.round, map: new Map() };

  const empty = state.line.length === 0;
  const maxUnit = Math.max(14, Math.min(34, h / 8.5));
  // 다음 패 자리를 언제나 함께 배치해 둔다 (차례가 바뀌어도 줄이 출렁이지 않게).
  const base = useMemo(
    () =>
      w > 0 && h > 0
        ? layoutLine(state.line, state.origin, w, h, { maxUnit, ghosts: empty ? { left: null, right: BLANK } : { left: BLANK, right: BLANK } })
        : null,
    [state.line, state.origin, w, h, maxUnit, empty],
  );

  // 더블을 미리 보여 줄 때는 엇갈려 놓이는 모양으로 자리를 다시 잰다 (같은 크기·가운데로).
  const previewDouble = !!preview && isDouble(preview);
  const doubleSlots = useMemo(() => {
    if (!base || !previewDouble) return null;
    const g: GhostSpec = { double: true, entry: null, exit: null };
    return layoutLine(state.line, state.origin, w, h, {
      maxUnit,
      ghosts: empty ? { left: null, right: g } : { left: g, right: g },
      fixed: empty ? null : { unit: base.unit, cx: base.cx, cy: base.cy },
    }).slots;
  }, [base, previewDouble, state.line, state.origin, w, h, maxUnit, empty]);

  const u = base?.unit ?? 24;
  const ends = lineEnds(state);
  const newest = state.line.reduce((m, p) => Math.max(m, p.order), -1);

  return (
    <div className="dm-wood">
      <div className="dm-felt" ref={feltRef} data-testid="dm-table" style={{ '--u': `${u}px`, '--fly': `${flyMs}ms` } as CSSProperties}>
        {base &&
          state.line.map((placed, i) => {
            const p = base.tiles[i];
            const map = rots.current.map;
            const prev = map.get(placed.tile.id);
            // 다시 배치될 때 가장 짧은 쪽으로 돌도록 각도를 이어 붙인다.
            const rot = prev === undefined ? p.rot : prev + ((((p.rot - prev) % 360) + 540) % 360) - 180;
            map.set(placed.tile.id, rot);
            const key = tileKey(state.round, placed.tile.id);
            const flying = playFrom && playFrom.key === key && flyMs > 0;
            const style = {
              left: p.x - u,
              top: p.y - u / 2,
              width: 2 * u,
              height: u,
              '--r': `${rot}deg`,
              ...(flying ? { '--fx': `${playFrom.x - p.x}px`, '--fy': `${playFrom.y - p.y}px`, '--delay': `${playFrom.delay}ms` } : {}),
            } as CSSProperties;
            return (
              <div
                key={key}
                className={`dm-line-tile${flying ? ' dm-fly' : ''}${placed.order === newest ? ' dm-newest' : ''}${isDouble(placed.tile) ? ' dm-is-double' : ''}`}
                style={style}
                data-testid="dm-line-tile"
              >
                <DominoFace a={p.a} b={p.b} colors={pipColors} title={`${placed.tile.a}·${placed.tile.b}`} />
              </div>
            );
          })}

        {base &&
          interactive &&
          SIDES.map((side) => {
            const slot0 = base.slots[side];
            if (!slot0) return null;
            const fits = preview ? sidesFor(state, preview).includes(side) : false;
            const slot: TilePos = (fits && previewDouble && doubleSlots?.[side]) || slot0;
            const o = preview && fits ? orient(state, preview, side) : null;
            const endNum = empty ? null : side === 'left' ? ends!.left : ends!.right;
            const clickable = fits;
            const active = choosing && fits && activeSide === side;
            const cls = ['dm-slot', fits ? 'dm-slot-ok' : '', choosing && fits ? 'dm-slot-choose' : '', active ? 'dm-slot-active' : '', preview && !fits ? 'dm-slot-no' : '']
              .filter(Boolean)
              .join(' ');
            const label = empty ? '첫 패 놓기' : `${side === 'left' ? '왼쪽' : '오른쪽'} 끝 (${endNum})${fits ? '에 놓기' : ''}`;
            return (
              <button
                key={side}
                type="button"
                className={cls}
                style={{ left: slot.x - slot.w / 2, top: slot.y - slot.h / 2, width: slot.w, height: slot.h }}
                onClick={() => clickable && props.onSlot(side)}
                onMouseDown={(e) => e.preventDefault()}
                disabled={!clickable}
                aria-label={label}
                title={label}
                data-testid={`dm-slot-${side}`}
              >
                {o ? (
                  <span className="dm-slot-preview" style={{ width: 2 * u, height: u, '--r': `${slot.rot}deg` } as CSSProperties}>
                    <DominoFace a={o.entry} b={o.exit} colors={pipColors} />
                  </span>
                ) : (
                  <span className="dm-slot-num">{empty ? '★' : endNum}</span>
                )}
                {choosing && fits && <span className={`dm-slot-tag dm-slot-tag-${side}`}>{side === 'left' ? '← 왼쪽' : '오른쪽 →'}</span>}
              </button>
            );
          })}

        {turnHint && <div className="dm-felt-hint">{turnHint}</div>}
        {fx && (
          <div key={fx.id} className={`dm-felt-fx dm-fx-${fx.tone}`}>
            {fx.text}
          </div>
        )}
      </div>
    </div>
  );
}
