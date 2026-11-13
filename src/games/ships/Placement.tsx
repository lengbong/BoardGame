import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { withJosa } from '../../lib/korean';
import { sfx } from '../../lib/sound';
import { Board, cellFromPoint } from './Board';
import { FLEETS, PROBLEM_TEXT, blockedCells, cellName, clampShip, isValidFleet, placementProblem, randomFleet, shipCells } from './fleet';
import { shipAt } from './rules';
import { ShipIcon } from './ShipArt';
import { shipsSfx } from './sounds';
import type { Dir, PlacedShip, SeaSize, ShipKind } from './types';

interface PlacementProps {
  size: SeaSize;
  noTouch: boolean;
  name: string;
  color: string;
  onDone: (fleet: PlacedShip[]) => void;
}

/** 손에 든(놓으려는) 배. grab: 배의 몇 번째 칸을 잡았는지, origin: 판에서 집었으면 원래 자리 */
interface Held {
  id: ShipKind;
  dir: Dir;
  grab: number;
  origin: PlacedShip | null;
}

/** 누르고 끌기 시작 전의 정보 */
interface Pending {
  id: ShipKind;
  grab: number;
  origin: PlacedShip | null;
  startX: number;
  startY: number;
  active: boolean;
}

/** 사람이 배를 숨기는 화면: 끌어다 놓기, 눌러서 놓기, 방향키 + Enter, R 돌리기, 무작위, 모두 지우기 */
export function Placement({ size, noTouch, name, color, onDone }: PlacementProps) {
  const specs = FLEETS[size];
  const [fleet, setFleet] = useState<PlacedShip[]>([]);
  const [held, setHeld] = useState<Held | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const [lastTouched, setLastTouched] = useState<ShipKind | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pending = useRef<Pending | null>(null);

  const complete = isValidFleet(fleet, size, noTouch);

  /** 손에 든 배를 cell 칸에 놓을 때의 자리 (판 안으로 당긴다) */
  const shipAtCell = useCallback(
    (h: Held, cell: number): PlacedShip => {
      const x = (cell % size) - (h.dir === 'h' ? h.grab : 0);
      const y = Math.floor(cell / size) - (h.dir === 'v' ? h.grab : 0);
      return clampShip(h.id, x, y, h.dir, size);
    },
    [size],
  );

  const preview = useMemo(() => {
    if (!held || cursor === null) return null;
    const ship = shipAtCell(held, cursor);
    return { ship, ok: placementProblem(ship, fleet, size, noTouch) === null };
  }, [held, cursor, fleet, size, noTouch, shipAtCell]);

  const zone = useMemo(() => {
    if (!held || !noTouch) return null;
    const all = blockedCells(fleet, size, true);
    for (const s of fleet) for (const c of shipCells(s, size)) all.delete(c);
    return all;
  }, [held, noTouch, fleet, size]);

  const bad = (text: string) => {
    setMessage({ text, bad: true });
    sfx.noMove();
    const el = svgRef.current;
    if (el && typeof el.animate === 'function' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' }],
        { duration: 320, easing: 'ease-out' },
      );
    }
  };

  const nextUnplaced = (placed: PlacedShip[], except?: ShipKind) => specs.find((s) => s.id !== except && !placed.some((p) => p.id === s.id));

  /** 손에 든 배를 내려놓지 못하고 그만둘 때: 판에서 집은 배는 제자리로 */
  const restore = useCallback((h: Held | null) => {
    if (h?.origin) setFleet((f) => [...f.filter((s) => s.id !== h.id), h.origin!]);
  }, []);

  const pickFromDock = (id: ShipKind) => {
    if (held?.id === id) {
      restore(held);
      setHeld(null);
      return;
    }
    restore(held);
    const onBoard = fleet.find((s) => s.id === id);
    if (onBoard) {
      setFleet((f) => f.filter((s) => s.id !== id));
      setHeld({ id, dir: onBoard.dir, grab: 0, origin: onBoard });
    } else {
      setHeld({ id, dir: held?.dir ?? 'h', grab: 0, origin: null });
    }
    setMessage({ text: `${withJosa(specs.find((s) => s.id === id)!.name, '을/를')} 놓을 칸을 고르세요.`, bad: false });
    shipsSfx.pickup();
  };

  const pickFromBoard = (cell: number) => {
    const ship = shipAt(fleet, cell, size);
    if (!ship) return false;
    restore(held);
    setFleet((f) => f.filter((s) => s.id !== ship.id));
    setHeld({ id: ship.id, dir: ship.dir, grab: shipCells(ship, size).indexOf(cell), origin: ship });
    setLastTouched(ship.id);
    setMessage({ text: `${withJosa(specs.find((s) => s.id === ship.id)!.name, '을/를')} 집었어요. 새 자리를 고르세요.`, bad: false });
    shipsSfx.pickup();
    return true;
  };

  /** 손에 든 배를 cell에 놓는다. autoNext면 다음 배를 바로 집는다 (눌러서 놓기·키보드). */
  const dropAt = (h: Held, cell: number, autoNext: boolean): boolean => {
    const ship = shipAtCell(h, cell);
    const others = fleet.filter((s) => s.id !== h.id);
    const problem = placementProblem(ship, others, size, noTouch);
    if (problem) {
      bad(PROBLEM_TEXT[problem]);
      return false;
    }
    const placed = [...others, ship];
    setFleet(placed);
    setLastTouched(ship.id);
    const spec = specs.find((s) => s.id === ship.id)!;
    const next = autoNext ? nextUnplaced(placed) : undefined;
    setHeld(next ? { id: next.id, dir: h.dir, grab: 0, origin: null } : null);
    setMessage({ text: `${withJosa(spec.name, '을/를')} ${cellName(shipCells(ship, size)[0], size)}에 놓았어요.`, bad: false });
    shipsSfx.place();
    return true;
  };

  const rotate = () => {
    if (held) {
      setHeld({ ...held, dir: held.dir === 'h' ? 'v' : 'h' });
      shipsSfx.rotate();
      return;
    }
    const ship = fleet.find((s) => s.id === lastTouched);
    if (!ship) {
      bad('돌릴 배를 먼저 고르세요.');
      return;
    }
    const turned = clampShip(ship.id, ship.x, ship.y, ship.dir === 'h' ? 'v' : 'h', size);
    const problem = placementProblem(turned, fleet, size, noTouch);
    if (problem) {
      bad(`돌릴 수 없어요: ${PROBLEM_TEXT[problem]}`);
      return;
    }
    setFleet((f) => f.map((s) => (s.id === ship.id ? turned : s)));
    shipsSfx.rotate();
  };

  const randomize = () => {
    setFleet(randomFleet(size, noTouch, Math.random));
    setHeld(null);
    setLastTouched(null);
    setMessage({ text: '배를 무작위로 놓았어요. 마음에 들지 않으면 다시 누르거나 배를 옮기세요.', bad: false });
    shipsSfx.place();
  };

  const clearAll = () => {
    setFleet([]);
    setHeld(null);
    setLastTouched(null);
    setMessage({ text: '모두 치웠어요.', bad: false });
    shipsSfx.pickup();
  };

  const finish = () => {
    if (!complete) {
      bad('배를 모두 놓아야 해요.');
      return;
    }
    onDone(fleet);
  };

  // ------------------------------------------------------------ 마우스: 끌어다 놓기
  const startPending = (id: ShipKind, grab: number, origin: PlacedShip | null, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    pending.current = { id, grab, origin, startX: e.clientX, startY: e.clientY, active: false };
  };

  const onCellDown = (cell: number, e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    setCursor(cell);
    if (held) {
      dropAt(held, cell, true);
      return;
    }
    const ship = shipAt(fleet, cell, size);
    if (ship) startPending(ship.id, shipCells(ship, size).indexOf(cell), ship, e);
  };

  // 창 전체에서 포인터를 따라간다 (판 밖으로 나가도)
  const latest = useRef({ held, fleet, dropAt, pickFromBoard, pickFromDock, restore });
  latest.current = { held, fleet, dropAt, pickFromBoard, pickFromDock, restore };
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      if (!p.active) {
        if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < 6) return;
        p.active = true;
        const cur = latest.current;
        cur.restore(cur.held);
        const dir = p.origin?.dir ?? cur.held?.dir ?? 'h';
        if (p.origin) setFleet((f) => f.filter((s) => s.id !== p.id));
        setHeld({ id: p.id, dir, grab: p.grab, origin: p.origin });
        shipsSfx.pickup();
      }
      setDragPos({ x: e.clientX, y: e.clientY });
      setCursor(cellFromPoint(svgRef.current, e.clientX, e.clientY, size));
    };
    const onUp = (e: PointerEvent) => {
      const p = pending.current;
      if (!p) return;
      pending.current = null;
      setDragPos(null);
      const cur = latest.current;
      if (!p.active) {
        // 움직이지 않고 뗐으면: 판의 배는 집고, 고르기 칸의 배는 손에 든다
        if (p.origin) cur.pickFromBoard(shipCells(p.origin, size)[p.grab]);
        else cur.pickFromDock(p.id);
        return;
      }
      const cell = cellFromPoint(svgRef.current, e.clientX, e.clientY, size);
      const h: Held = cur.held?.id === p.id ? cur.held : { id: p.id, dir: p.origin?.dir ?? 'h', grab: p.grab, origin: p.origin };
      if (cell === null || !cur.dropAt(h, cell, false)) {
        cur.restore(h);
        setHeld(null);
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [size]);

  // ------------------------------------------------------------ 키보드
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      const isButton = target?.tagName === 'BUTTON';
      const key = e.key;
      if (key === 'r' || key === 'R' || key === 'ㄱ') {
        e.preventDefault();
        rotate();
      } else if (key.startsWith('Arrow')) {
        e.preventDefault();
        setCursor((c) => {
          const start = c ?? Math.floor(size / 2) * size + Math.floor(size / 2) - 1;
          if (c === null) return start;
          const x = start % size;
          const y = Math.floor(start / size);
          if (key === 'ArrowLeft') return y * size + Math.max(0, x - 1);
          if (key === 'ArrowRight') return y * size + Math.min(size - 1, x + 1);
          if (key === 'ArrowUp') return Math.max(0, y - 1) * size + x;
          return Math.min(size - 1, y + 1) * size + x;
        });
      } else if ((key === 'Enter' || key === ' ') && !isButton) {
        e.preventDefault();
        if (cursor === null) {
          setCursor(Math.floor(size / 2) * size + Math.floor(size / 2) - 1);
          return;
        }
        if (held) dropAt(held, cursor, true);
        else if (!pickFromBoard(cursor)) {
          const next = nextUnplaced(fleet);
          if (next) pickFromDock(next.id);
          else if (complete) setMessage({ text: "다 놓았어요! '준비 완료'를 누르세요.", bad: false });
        }
      } else if (/^[1-5]$/.test(key)) {
        const spec = specs[Number(key) - 1];
        if (spec) pickFromDock(spec.id);
      } else if (key === 'Escape' && held) {
        restore(held);
        setHeld(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const heldSpec = held ? specs.find((s) => s.id === held.id) : null;
  let guide: string;
  if (heldSpec) guide = `${heldSpec.name}(${heldSpec.length}칸)을 놓을 칸을 누르세요. R 또는 오른쪽 클릭으로 돌려요.`;
  else if (complete) guide = "다 놓았어요! 배를 옮기거나 '준비 완료'를 누르세요.";
  else guide = '배를 끌어다 바다에 놓거나, 배를 누른 뒤 바다 칸을 누르세요.';

  return (
    <div className="sh-place">
      <div className="sh-place-board sh-board-card" style={{ borderColor: color }}>
        <header className="sh-board-head" style={{ background: color }}>
          <strong>{name}의 바다</strong>
          <span>배를 숨겨요</span>
        </header>
        <div className="sh-board-body">
          <Board
            size={size}
            svgRef={svgRef}
            ariaLabel={`${name}의 바다 (배 놓기). ${fleet.length}척 놓음`}
            ships={fleet}
            marks={[]}
            cursor={cursor}
            cursorKind="place"
            preview={preview}
            zone={zone}
            interactive
            onCellDown={onCellDown}
            onHover={(c) => {
              if (!pending.current?.active) setCursor(c);
            }}
            onCellContext={(c) => {
              if (held) rotate();
              else {
                const ship = shipAt(fleet, c, size);
                if (ship) {
                  setLastTouched(ship.id);
                  const turned = clampShip(ship.id, ship.x, ship.y, ship.dir === 'h' ? 'v' : 'h', size);
                  const problem = placementProblem(turned, fleet, size, noTouch);
                  if (problem) bad(`돌릴 수 없어요: ${PROBLEM_TEXT[problem]}`);
                  else {
                    setFleet((f) => f.map((s) => (s.id === ship.id ? turned : s)));
                    shipsSfx.rotate();
                  }
                }
              }
            }}
          />
        </div>
      </div>

      <section className="sh-dock" aria-label="배 고르기">
        <h2>배 고르기</h2>
        <p className="sh-dock-guide">{guide}</p>
        <ul className="sh-dock-list">
          {specs.map((spec, i) => {
            const placed = fleet.some((s) => s.id === spec.id);
            const isHeld = held?.id === spec.id;
            return (
              <li key={spec.id}>
                <button
                  type="button"
                  className={`sh-dock-item${placed ? ' sh-dock-placed' : ''}${isHeld ? ' sh-dock-held' : ''}`}
                  onPointerDown={(e) => {
                    if (placed) return;
                    startPending(spec.id, 0, null, e);
                  }}
                  onClick={(e) => {
                    // 키보드(Enter/Space)로 누른 경우만. 마우스는 pointerup에서 처리한다.
                    if (e.detail === 0 || placed) pickFromDock(spec.id);
                  }}
                  aria-pressed={isHeld}
                  aria-label={`${spec.name} ${spec.length}칸${placed ? ', 놓음 (누르면 다시 집어요)' : ''}`}
                >
                  <kbd>{i + 1}</kbd>
                  <span className="sh-dock-art">
                    <ShipIcon id={spec.id} cell={18} vertical={false} />
                  </span>
                  <span className="sh-dock-name">
                    <strong>{spec.name}</strong>
                    <small>{spec.length}칸</small>
                  </span>
                  <span className="sh-dock-state" aria-hidden="true">
                    {placed ? '✓' : isHeld ? '✋' : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className={`sh-dock-msg${message?.bad ? ' sh-dock-msg-bad' : ''}`} role="status" aria-live="polite">
          {message?.text ?? ' '}
        </p>
        <div className="sh-dock-tools">
          <button type="button" className="btn" onClick={rotate} title="손에 든 배나 마지막에 놓은 배를 돌려요">
            ↻ 돌리기 <kbd>R</kbd>
          </button>
          <button type="button" className="btn" onClick={randomize} data-testid="sh-random">
            🎲 무작위로 놓기
          </button>
          <button type="button" className="btn" onClick={clearAll} disabled={fleet.length === 0 && !held}>
            🧹 모두 지우기
          </button>
        </div>
        <button type="button" className="btn btn-primary btn-large sh-ready" onClick={finish} disabled={!complete} data-testid="sh-ready">
          ⚓ 준비 완료
        </button>
        <p className="sh-dock-keys">
          <kbd>방향키</kbd> 칸 고르기 · <kbd>Enter</kbd> 놓기/집기 · <kbd>1</kbd>~<kbd>{specs.length}</kbd> 배 고르기 · <kbd>Esc</kbd> 내려놓기 취소
        </p>
      </section>

      {dragPos && held && cursor === null && (
        <div className="sh-drag-ghost" style={{ left: dragPos.x, top: dragPos.y }} aria-hidden="true">
          <ShipIcon id={held.id} cell={30} vertical={held.dir === 'v'} />
        </div>
      )}
    </div>
  );
}
