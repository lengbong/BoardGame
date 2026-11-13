import type { CSSProperties, ReactNode } from 'react';
import { Confetti } from '../../components/Confetti';
import { TEAM_COLORS, TeamCap } from './art';
import { codeText, targetOf } from './rules';
import type { BaseballState, Side } from './types';

interface ResultsProps {
  state: BaseballState;
  /** 혼자 맞히기: 이번에 최고 기록을 새로 세웠는지, 최고 기록 */
  newRecord: boolean;
  best?: number;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
  onClose: () => void;
}

function SecretTiles({ digits }: { digits: number[] | null }) {
  return (
    <span className="bb-secret bb-secret-big">
      {(digits ?? []).map((d, i) => (
        <span key={i} className="bb-secret-digit bb-secret-open" style={{ '--i': i } as CSSProperties}>
          {d}
        </span>
      ))}
    </span>
  );
}

export function Results({ state, newRecord, best, onRestart, onChangeSetup, onExit, onClose }: ResultsProps) {
  const solo = state.options.mode === 'solo';
  const winner = state.winner;
  const humans = state.players.filter((p) => p.kind === 'human').length;
  const humanLost = !solo && winner !== null && state.players[winner].kind !== 'human' && humans === 1;
  const party = solo ? !state.gaveUp : winner !== null && !humanLost;
  const count = state.players[0].guesses.length;

  let icon: ReactNode;
  let title: string;
  let sub: string;
  if (solo) {
    icon = state.gaveUp ? '🙈' : '🏆';
    title = state.gaveUp ? `답은 ${codeText(state.players[1].secret ?? [])}였어요` : `${count}번 만에 맞혔어요!`;
    sub = state.gaveUp
      ? '괜찮아요! 메모를 쓰며 아웃 숫자부터 지워 보세요.'
      : newRecord
        ? '🎉 최고 기록을 새로 세웠어요!'
        : best
          ? `최고 기록은 ${best}번이에요. 다음엔 더 빨리!`
          : '홈런! 숨긴 숫자를 찾았어요.';
  } else if (winner === null) {
    icon = '🤝';
    title = '무승부!';
    sub = `둘 다 ${state.players[0].guesses.length}번 만에 맞혔어요.`;
  } else {
    icon = <TeamCap side={winner} size={72} />;
    title = `${state.players[winner].name} 승리!`;
    sub = humanLost
      ? '아쉬워요! 메모와 추리 도우미를 써 보면 더 빨리 찾을 수 있어요.'
      : `${state.players[winner].guesses.length}번 만에 상대 숫자를 맞혔어요!`;
  }

  return (
    <div className="overlay bb-result-overlay" role="dialog" aria-modal="true" aria-labelledby="bb-result-title">
      {party && <Confetti />}
      <div className="result-card bb-result" data-testid="bb-result">
        <button type="button" className="btn btn-ghost bb-result-close" onClick={onClose} aria-label="닫고 전광판 보기" title="닫고 전광판 보기">
          ✕
        </button>
        <div className="trophy" aria-hidden="true">
          {icon}
        </div>
        <h2 id="bb-result-title">{title}</h2>
        <p className="bb-result-sub">{sub}</p>
        <div className="bb-result-secrets">
          {(solo ? [1] : [0, 1]).map((i) => {
            const side = i as Side;
            const p = state.players[side];
            return (
              <div key={side} className="bb-result-secret" style={{ borderColor: solo ? '#2f8f4e' : TEAM_COLORS[side].main }}>
                <span>{solo ? `${p.name}가 숨긴 숫자` : `${p.name}의 숫자`}</span>
                <SecretTiles digits={p.secret} />
                {!solo && (
                  <small>
                    {state.players[targetOf(state, side)].name}: {state.players[targetOf(state, side)].guesses.length}번 쳤어요
                  </small>
                )}
              </div>
            );
          })}
        </div>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="bb-restart">
            같은 설정으로 다시 하기
          </button>
          <button type="button" className="btn" onClick={onChangeSetup}>
            설정 바꾸기
          </button>
          <button type="button" className="btn" onClick={onExit}>
            처음 화면
          </button>
        </div>
      </div>
    </div>
  );
}
