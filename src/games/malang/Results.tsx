import { Confetti } from '../../components/Confetti';
import { PairPreview, SIDE_COLORS } from './JellyArt';
import type { MalangRecords } from './storage';
import type { MalangState } from './types';

interface ResultsProps {
  state: MalangState;
  records: MalangRecords;
  newRecord: boolean;
  onRestart: () => void;
  onChangeSetup: () => void;
  onExit: () => void;
  onClose: () => void;
}

export function Results({ state, records, newRecord, onRestart, onChangeSetup, onExit, onClose }: ResultsProps) {
  const solo = state.options.mode === 'solo';
  const winner = state.winner;
  const humans = state.players.filter((p) => p.kind === 'human').length;
  const humanLost = !solo && winner !== null && state.players[winner].kind !== 'human' && humans === 1;
  const party = solo ? newRecord : winner !== null && !humanLost;
  const seconds = Math.floor(state.time / 1000);
  const time = `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;

  let title: string;
  let sub: string;
  if (solo) {
    const p = state.players[0];
    title = `${p.score.toLocaleString('ko-KR')}점!`;
    sub = newRecord ? '🎉 최고 점수를 새로 세웠어요!' : `최고 점수는 ${records.soloScore.toLocaleString('ko-KR')}점이에요.`;
  } else if (winner === null) {
    title = '비겼어요!';
    sub = '둘이 동시에 꽉 찼어요.';
  } else {
    title = `${state.players[winner].name} 승리!`;
    sub = humanLost ? '아까워요! 젤리를 같은 색끼리 모아 두었다가 한꺼번에 연쇄로 터뜨려 보세요.' : state.options.winsNeeded > 1 ? `${state.wins[0]} : ${state.wins[1]}로 이겼어요!` : '상대 판을 가득 채웠어요!';
  }

  const rows: [string, (i: number) => string][] = [
    ['점수', (i) => state.players[i].score.toLocaleString('ko-KR')],
    ['가장 긴 연쇄', (i) => `${state.players[i].stats.maxChain}연쇄`],
    ['터뜨린 젤리', (i) => `${state.players[i].stats.popped}개`],
    ...(solo
      ? ([['레벨', (i: number) => `${state.players[i].level}`]] as [string, (i: number) => string][])
      : ([
          ['보낸 방해 젤리', (i: number) => `${state.players[i].stats.garbageSent}개`],
          ['받은 방해 젤리', (i: number) => `${state.players[i].stats.garbageReceived}개`],
        ] as [string, (i: number) => string][])),
    ['판 비우기', (i) => `${state.players[i].stats.allClears}번`],
  ];

  return (
    <div className="overlay mp-result-overlay" role="dialog" aria-modal="true" aria-labelledby="mp-result-title">
      {party && <Confetti />}
      <div className="result-card mp-result" data-testid="mp-result">
        <button type="button" className="btn btn-ghost mp-result-close" onClick={onClose} aria-label="닫고 판 보기" title="닫고 판 보기">
          ✕
        </button>
        <div className="trophy mp-trophy" aria-hidden="true">
          {humanLost ? <PairPreview colors={[2, 2]} /> : '🏆'}
        </div>
        <h2 id="mp-result-title">{title}</h2>
        <p className="mp-result-sub">{sub}</p>
        <table className="mp-stats">
          {!solo && (
            <thead>
              <tr>
                <th />
                {state.players.map((p, i) => (
                  <th key={i} style={{ color: SIDE_COLORS[i] }}>
                    {p.name}
                    {winner === i && ' 🏆'}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th>{label}</th>
                {state.players.map((_, i) => (
                  <td key={i}>{value(i)}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th>걸린 시간</th>
              <td colSpan={state.players.length}>{time}</td>
            </tr>
          </tbody>
        </table>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRestart} data-testid="mp-restart">
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
