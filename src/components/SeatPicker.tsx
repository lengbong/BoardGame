import { KindPicker } from './KindPicker';
import { SEAT_COLORS, SEAT_INDICES, SEAT_KIND_OPTIONS, activeSeatCount, type SeatIndex, type SeatKind, type Seats } from '../games/common/players';

interface SeatPickerProps {
  seats: Seats;
  onChange: (seats: Seats) => void;
}

/** 자리마다 사람/컴퓨터/비움과 이름을 고르는 카드 4장 */
export function SeatPicker({ seats, onChange }: SeatPickerProps) {
  const update = (i: SeatIndex, patch: Partial<Seats[number]>) =>
    onChange(seats.map((s, k) => (k === i ? { ...s, ...patch } : s)) as Seats);

  return (
    <>
      <div className="seat-grid">
        {SEAT_INDICES.map((i) => {
          const seat = seats[i];
          const c = SEAT_COLORS[i];
          return (
            <div key={i} className={`seat-card${seat.kind === 'empty' ? ' seat-empty' : ''}`} style={{ borderColor: c.main }}>
              <div className="seat-head" style={{ background: c.main }}>
                {c.name}
              </div>
              <KindPicker
                caption="참가"
                value={seat.kind}
                options={SEAT_KIND_OPTIONS}
                onChange={(kind: SeatKind) => update(i, { kind })}
                color={c.main}
                testId={`seat-kind-${i}`}
              />
              <label className="seat-name">
                <span>이름</span>
                <input
                  type="text"
                  value={seat.name}
                  maxLength={8}
                  placeholder={c.name}
                  disabled={seat.kind === 'empty'}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
              </label>
            </div>
          );
        })}
      </div>
      {activeSeatCount(seats) < 2 && <p className="warn">2명 이상 참가해야 시작할 수 있어요.</p>}
    </>
  );
}
