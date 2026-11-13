import { DUEL_KIND_OPTIONS, type DuelKind, type DuelSeats, type DuelSide } from '../games/common/duel';

interface DuelPickerProps {
  seats: DuelSeats;
  sides: [DuelSide, DuelSide];
  onChange: (seats: DuelSeats) => void;
  /** 고를 수 있는 참가 종류 (기본: 사람, 쉬움, 보통, 어려움) */
  kinds?: DuelKind[];
  /** 왼쪽 자리 머리띠에 붙는 말 (기본 '먼저') */
  firstNote?: string;
}

/** 두 사람 게임의 자리 선택: 왼쪽이 먼저 둔다. 가운데 ⇄ 버튼으로 서로 바꾼다. */
export function DuelPicker({ seats, sides, onChange, kinds, firstNote = '먼저' }: DuelPickerProps) {
  const options = kinds ? DUEL_KIND_OPTIONS.filter((o) => kinds.includes(o.value)) : DUEL_KIND_OPTIONS;
  const update = (i: 0 | 1, patch: Partial<DuelSeats[number]>) =>
    onChange(seats.map((s, k) => (k === i ? { ...s, ...patch } : s)) as DuelSeats);

  return (
    <div className="duel-grid">
      {([0, 1] as const).map((i) => {
        const side = sides[i];
        const seat = seats[i];
        return (
          <div key={i} className="duel-card" style={{ borderColor: side.color, order: i * 2 }}>
            <div className="duel-head" style={{ background: side.color, color: side.textColor ?? '#fff' }}>
              {side.icon && (
                <span className="duel-icon" aria-hidden="true">
                  {side.icon}
                </span>
              )}
              <strong>{side.label}</strong>
              {i === 0 && firstNote && <span className="duel-first">{firstNote}</span>}
            </div>
            <label>
              <span>참가</span>
              <select value={seat.kind} onChange={(e) => update(i, { kind: e.target.value as DuelKind })} data-testid={`duel-kind-${i}`}>
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>이름</span>
              <input type="text" value={seat.name} maxLength={8} placeholder={side.label} onChange={(e) => update(i, { name: e.target.value })} />
            </label>
          </div>
        );
      })}
      <button
        type="button"
        className="btn duel-swap"
        style={{ order: 1 }}
        onClick={() => onChange([{ ...seats[1] }, { ...seats[0] }])}
        title="두 자리를 서로 바꿔요 (누가 먼저 할지 바꾸기)"
        aria-label="두 자리 서로 바꾸기"
      >
        ⇄
      </button>
    </div>
  );
}
