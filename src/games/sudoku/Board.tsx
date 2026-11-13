import { memo, type CSSProperties, type ReactNode } from 'react';
import { BOX_OF, COL_OF, ROW_OF, UNITS, digitsOf } from './grid';
import { givenMask } from './rules';
import type { Puzzle } from './types';

export interface CellFx {
  cell: number;
  kind: 'pop' | 'shake' | 'hint';
  seq: number;
}

export interface FlashFx {
  /** 칸 → 물결 순서 */
  cells: Map<number, number>;
  seq: number;
}

interface BoardProps {
  puzzle: Puzzle;
  values: readonly number[];
  notes: readonly number[];
  hinted: readonly number[];
  selected: number;
  hidden: boolean;
  wrong: ReadonlySet<number>;
  conflicts: ReadonlySet<number>;
  fx: CellFx | null;
  flash: FlashFx | null;
  /** 힌트로 강조할 묶음 */
  hintUnit: number | null;
  onSelect: (cell: number) => void;
}

const NOTE_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const Board = memo(function Board({ puzzle, values, notes: allNotes, hinted: hintedList, selected, hidden, wrong, conflicts, fx, flash, hintUnit, onSelect }: BoardProps) {
  const given = givenMask(puzzle);
  const selValue = selected >= 0 ? values[selected] : 0;
  const hintCells = hintUnit !== null ? new Set(UNITS[hintUnit]) : null;
  const hinted = new Set(hintedList);
  const rows: ReactNode[] = [];
  for (let r = 0; r < 9; r++) {
    const cells: ReactNode[] = [];
    for (let c = 0; c < 9; c++) {
      const i = r * 9 + c;
      const v = values[i];
      const notes = allNotes[i];
      const isSel = i === selected;
      const peer =
        selected >= 0 && !isSel && (ROW_OF[i] === ROW_OF[selected] || COL_OF[i] === COL_OF[selected] || BOX_OF[i] === BOX_OF[selected]);
      const cls = ['sd-cell'];
      if (given[i]) cls.push('sd-given');
      else if (v) cls.push('sd-user');
      if (c === 2 || c === 5) cls.push('sd-br');
      if (r === 2 || r === 5) cls.push('sd-bb');
      if (isSel) cls.push('sd-sel');
      else if (selValue && v === selValue) cls.push('sd-same');
      else if (peer) cls.push('sd-peer');
      if (v && conflicts.has(i)) cls.push('sd-conflict');
      if (v && wrong.has(i)) cls.push('sd-wrong');
      if (hinted.has(i) && v) cls.push('sd-hinted');
      if (hintCells?.has(i)) cls.push('sd-hint-unit');
      const flashAt = flash?.cells.get(i);
      if (flashAt !== undefined) cls.push('sd-flash');
      const cellFx = fx && fx.cell === i ? fx : null;
      const label = `${r + 1}째 줄 ${c + 1}째 칸, ${
        v ? `${v}${given[i] ? ' (처음 숫자)' : ''}${wrong.has(i) ? ', 틀림' : ''}${conflicts.has(i) ? ', 겹침' : ''}` : '빈칸'
      }${!v && notes ? `, 메모 ${digitsOf(notes).join(' ')}` : ''}`;
      cells.push(
        <div
          key={i}
          id={`sd-cell-${i}`}
          role="gridcell"
          aria-selected={isSel}
          aria-label={label}
          className={cls.join(' ')}
          style={flashAt !== undefined ? ({ '--wave': flashAt } as CSSProperties) : undefined}
          onPointerDown={(e) => {
            e.preventDefault();
            onSelect(i);
          }}
          data-flash={flashAt !== undefined ? flash!.seq : undefined}
        >
          {v ? (
            <span key={cellFx ? `${cellFx.kind}${cellFx.seq}` : 'v'} className={`sd-digit${cellFx ? ` sd-fx-${cellFx.kind}` : ''}`}>
              {v}
            </span>
          ) : notes ? (
            <span className={`sd-notes${cellFx ? ` sd-fx-${cellFx.kind}` : ''}`}>
              {NOTE_DIGITS.map((d) => (
                <span key={d} className={notes & (1 << (d - 1)) ? (d === selValue ? 'sd-note sd-note-hit' : 'sd-note') : 'sd-note sd-note-off'}>
                  {notes & (1 << (d - 1)) ? d : ''}
                </span>
              ))}
            </span>
          ) : cellFx?.kind === 'shake' ? (
            <span key={`s${cellFx.seq}`} className="sd-digit sd-fx-shake" />
          ) : null}
          {v && conflicts.has(i) ? <span className="sd-mark" aria-hidden="true" /> : null}
        </div>,
      );
    }
    rows.push(
      <div key={r} role="row" className="sd-row">
        {cells}
      </div>,
    );
  }
  return (
    <div
      className={`sd-board${hidden ? ' sd-board-hidden' : ''}`}
      role="grid"
      aria-label="스도쿠 판 (화살표로 칸 옮기기, 숫자키로 넣기)"
      aria-activedescendant={selected >= 0 ? `sd-cell-${selected}` : undefined}
      tabIndex={0}
      data-testid="sd-board"
    >
      {rows}
    </div>
  );
});
