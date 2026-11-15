import { useState } from 'react';
import './extras.css';
import { applyFarePlan, applyRenewPlan, applyTimesPlan, farePlan, renewPlan, renewText, timesPlan } from './bulk';
import { fmtFine } from './format';
import { MoreInfo } from './StaffArt';
import type { AirlineState } from './types';
import { ActButton } from './ui';

type Kind = 'fares' | 'times' | 'renew';

const TOOLS: { kind: Kind; icon: string; name: string; what: string }[] = [
  { kind: 'fares', icon: '🏷️', name: '운임 한꺼번에 맞추기', what: '노선마다 일반석·고급 좌석·화물 운임을 이번 달 이익이 가장 큰 값으로' },
  { kind: 'times', icon: '🕘', name: '시간표 한꺼번에 맞추기', what: '노선마다 아침·낮·저녁·밤 나누기를 손님에게 가장 맞게' },
  { kind: 'renew', icon: '♻️', name: '낡은 비행기 바꾸기', what: '열여덟 해 넘은 비행기를 같은 노선에서 더 버는 새 리스기로 (한 번에 여섯 대까지)' },
];

interface Preview {
  kind: Kind;
  /** 계획을 만든 상태 (상태가 바뀌면 다시 살펴본다) */
  state: AirlineState;
  count: number;
  gain: number;
  text: string;
  run: (s: AirlineState) => AirlineState;
}

/** 노선 화면의 '한꺼번에 고치기': 살펴보기 → 미리 보기 → 적용 */
export function BulkTools({ state, viewer, canAct, apply }: { state: AirlineState; viewer: number; canAct: boolean; apply: (fn: (s: AirlineState) => AirlineState) => void }) {
  const [open, setOpen] = useState(false);
  const [previews, setPreviews] = useState<Partial<Record<Kind, Preview>>>({});
  const [done, setDone] = useState<{ kind: Kind; text: string } | null>(null);
  const setPreview = (p: Preview) => setPreviews((cur) => ({ ...cur, [p.kind]: p }));

  const look = (kind: Kind) => {
    setDone(null);
    if (kind === 'fares') {
      const plan = farePlan(state, viewer);
      setPreview({ kind, state, count: plan.items.length, gain: plan.gain, text: `노선 ${plan.items.length}개`, run: (s) => applyFarePlan(s, plan) });
    } else if (kind === 'times') {
      const plan = timesPlan(state, viewer);
      setPreview({ kind, state, count: plan.items.length, gain: plan.gain, text: `노선 ${plan.items.length}개`, run: (s) => applyTimesPlan(s, plan) });
    } else {
      const plan = renewPlan(state, viewer);
      setPreview({ kind, state, count: plan.items.length, gain: plan.gain, text: plan.items.length ? `${plan.items.length}대 (${renewText(plan)})` : '', run: (s) => applyRenewPlan(s, viewer, plan) });
    }
  };

  return (
    <section className="al-bulk" data-testid="al-bulk">
      <button type="button" className="al-link al-bulk-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        🧰 한꺼번에 고치기 {open ? '▴' : '▾'}
      </button>
      {open && (
        <ul className="al-bulk-list">
          {TOOLS.map((t) => {
            const saved = previews[t.kind];
            const p = saved && saved.state === state ? saved : null;
            return (
              <li key={t.kind}>
                <span className="al-bulk-main">
                  <b>
                    {t.icon} {t.name}
                  </b>
                  <small className="al-muted">{t.what}</small>
                  {p && (p.count > 0 ? <small className="al-pos">{p.text} · 달 이익 약 +{fmtFine(p.gain)}</small> : <small className="al-muted">지금은 고칠 곳이 없어요</small>)}
                  {done?.kind === t.kind && <small className="al-pos">{done.text}</small>}
                </span>
                {p && p.count > 0 ? (
                  <ActButton
                    small
                    primary
                    blocker={canAct ? null : '내 차례에만 할 수 있어요'}
                    onClick={() => {
                      apply(p.run);
                      setDone({ kind: t.kind, text: `${p.text}을(를) 고쳤어요` });
                    }}
                    testId={`al-bulk-apply-${t.kind}`}
                  >
                    적용
                  </ActButton>
                ) : (
                  <button type="button" className="btn btn-small" onClick={() => look(t.kind)} data-testid={`al-bulk-look-${t.kind}`}>
                    살펴보기
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {open && <MoreInfo>노선이 많아지면 하나씩 고치기 번거로운 일을 한 번에 해요. 어림은 라이벌이 지금 그대로일 때의 이번 달 이익이라, 실제로는 조금 달라질 수 있어요.</MoreInfo>}
    </section>
  );
}
