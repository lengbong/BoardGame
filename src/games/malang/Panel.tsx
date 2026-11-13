import type { ReactNode } from 'react';
import { GameControls } from '../../components/GameControls';
import type { GameSettings } from '../common/settings';
import { SIDE_COLORS } from './JellyArt';
import type { MalangRecords } from './storage';
import type { DuelKind, GameMode, GamePhase } from './types';

interface PanelProps {
  mode: GameMode;
  players: { name: string; kind: DuelKind; chain: number; sent: number }[];
  humans: number;
  phase: GamePhase;
  paused: boolean;
  round: number;
  records: MalangRecords;
  settings: GameSettings;
  onSettings: (settings: GameSettings) => void;
  onPause: () => void;
  onNewGame: () => void;
  onExit: () => void;
  extra?: ReactNode;
}

const PHASE_TEXT: Record<GamePhase, string> = { countdown: '준비…', play: '하는 중', roundover: '한 판 끝', over: '끝!' };

function Keys({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="mp-keys">
      {rows.map(([what, keys]) => (
        <div key={what}>
          <dt>{what}</dt>
          <dd>{keys}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Panel(props: PanelProps) {
  const { mode, players, humans, records } = props;
  const solo = mode === 'solo';
  return (
    <aside className="panel mp-panel">
      <section className="turn-card" style={{ borderColor: '#ff8a3d', background: '#fff1e6' }}>
        <div className="turn-title">
          <span aria-hidden="true">🍮</span>
          <strong>{solo ? '혼자 하기' : `대결 · ${props.round}판`}</strong>
          <span>{props.paused ? '멈춤' : PHASE_TEXT[props.phase]}</span>
        </div>
        <p className="hint">
          {solo ? '같은 색 젤리 4개를 이어서 팡! 터진 뒤 떨어진 젤리가 또 이어지면 연쇄예요.' : '연쇄로 상대에게 방해 젤리를 보내요. 상대 판이 가운데(✕)까지 차면 이겨요!'}
        </p>
      </section>

      {!solo && (
        <section className="players mp-players">
          <h2>플레이어</h2>
          <ul>
            {players.map((p, i) => (
              <li key={i}>
                <span className="dot" style={{ background: SIDE_COLORS[i] }} />
                <span className="player-name">{p.name}</span>
                <span className="player-kind">{p.kind === 'human' ? '사람' : p.kind === 'ai-easy' ? '컴퓨터 · 쉬움' : p.kind === 'ai-normal' ? '컴퓨터 · 보통' : '컴퓨터 · 어려움'}</span>
                <span className="mp-chip" title="가장 긴 연쇄 · 보낸 방해 젤리">
                  {p.chain}연쇄 · {p.sent}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mp-help">
        <h2>조작</h2>
        {humans === 2 ? (
          <div className="mp-keys-duo">
            <div>
              <strong style={{ color: SIDE_COLORS[0] }}>{players[0].name} (왼쪽)</strong>
              <Keys
                rows={[
                  ['움직이기', <><kbd>A</kbd> <kbd>D</kbd></>],
                  ['돌리기', <><kbd>W</kbd> <kbd>Q</kbd></>],
                  ['빨리', <kbd>S</kbd>],
                  ['떨어뜨리기', <kbd>Space</kbd>],
                ]}
              />
            </div>
            <div>
              <strong style={{ color: SIDE_COLORS[1] }}>{players[1].name} (오른쪽)</strong>
              <Keys
                rows={[
                  ['움직이기', <><kbd>←</kbd> <kbd>→</kbd></>],
                  ['돌리기', <><kbd>↑</kbd> <kbd>/</kbd></>],
                  ['빨리', <kbd>↓</kbd>],
                  ['떨어뜨리기', <kbd>Enter</kbd>],
                ]}
              />
            </div>
          </div>
        ) : humans === 1 ? (
          <Keys
            rows={[
              ['움직이기', <><kbd>←</kbd> <kbd>→</kbd> 또는 <kbd>A</kbd> <kbd>D</kbd></>],
              ['돌리기', <><kbd>↑</kbd>·<kbd>X</kbd> 오른쪽, <kbd>Z</kbd> 왼쪽</>],
              ['빨리 내리기', <><kbd>↓</kbd> 또는 <kbd>S</kbd></>],
              ['바로 떨어뜨리기', <kbd>Space</kbd>],
            ]}
          />
        ) : (
          <p className="mp-watch">컴퓨터끼리 하는 것을 구경해요.</p>
        )}
        <p className="mp-keys-note">
          <kbd>P</kbd>·<kbd>Esc</kbd> 잠깐 멈추기
        </p>
      </section>

      <section className="mp-records">
        <h2>기록</h2>
        <ul>
          <li>
            혼자 하기 최고 점수 <b>{records.soloScore.toLocaleString('ko-KR')}</b>
          </li>
          <li>
            가장 긴 연쇄 <b>{records.bestChain}연쇄</b>
          </li>
          <li>
            컴퓨터를 이긴 횟수 <b>쉬움 {records.cpuWins['ai-easy'] ?? 0} · 보통 {records.cpuWins['ai-normal'] ?? 0} · 어려움 {records.cpuWins['ai-hard'] ?? 0}</b>
          </li>
        </ul>
      </section>

      {props.extra}

      <GameControls settings={props.settings} onSettings={props.onSettings} showSpeed={false} onNewGame={props.onNewGame} onExit={props.onExit}>
        <button type="button" className="btn" onClick={props.onPause} disabled={props.phase === 'over'} data-testid="mp-pause-btn">
          {props.paused ? '▶ 계속하기' : '⏸ 멈추기'} <kbd>P</kbd>
        </button>
      </GameControls>
    </aside>
  );
}
