import { useState } from 'react';
import { DIFFICULTIES, DIFFICULTY_INFO, parsePuzzleCode } from './generator';
import { formatTime, formatTimeKo, type SavedSudokuGame, type SudokuRecords } from './storage';
import type { Difficulty, MistakeMode, SudokuSetup as Setup } from './types';

interface SudokuSetupProps {
  setup: Setup;
  onSetup: (setup: Setup) => void;
  saved: SavedSudokuGame | null;
  records: SudokuRecords;
  busy: boolean;
  onStart: (setup: Setup) => void;
  onOpenCode: (difficulty: Difficulty, seed: number) => void;
  onResume: () => void;
  onPrint: () => void;
  onBack: () => void;
}

const MISTAKE_MODES: { value: MistakeMode; title: string; desc: string }[] = [
  { value: 'instant', title: '바로 표시', desc: '정답과 다른 숫자를 넣으면 바로 빨갛게 알려 줘요. 처음 배울 때 좋아요.' },
  { value: 'end', title: '다 채운 뒤 확인', desc: '다 채울 때까지 맞는지 알려 주지 않아요. 종이에 푸는 것처럼!' },
];

/** 제목 그림: 연필과 스도쿠 판 (직접 그린 SVG) */
export function SudokuHeroArt({ className = 'sd-hero-art' }: { className?: string }) {
  const cell = 14;
  const ox = 14;
  const oy = 16;
  const lines: string[] = [];
  const thick: string[] = [];
  for (let k = 1; k < 9; k++) {
    const p = k * cell;
    (k % 3 === 0 ? thick : lines).push(`M${ox + p} ${oy}v${cell * 9}M${ox} ${oy + p}h${cell * 9}`);
  }
  const digits: [number, number, number, boolean?][] = [
    [0, 0, 5],
    [0, 4, 7],
    [1, 2, 3],
    [1, 6, 1],
    [2, 1, 9],
    [2, 8, 6],
    [3, 3, 8],
    [4, 0, 4],
    [4, 4, 2, true],
    [4, 7, 9],
    [5, 5, 6],
    [6, 2, 1],
    [6, 7, 5],
    [7, 4, 3, true],
    [8, 1, 7],
    [8, 6, 2],
  ];
  return (
    <svg className={className} viewBox="0 0 170 170" aria-hidden="true">
      <g transform="rotate(-5 77 79)">
        <rect x={ox - 6} y={oy - 6} width={cell * 9 + 12} height={cell * 9 + 12} rx="9" fill="#fffdf6" stroke="#4a4236" strokeWidth="2" />
        <rect x={ox + 4 * cell} y={oy + 3 * cell} width={cell} height={cell * 3} fill="#ffe2c4" />
        <rect x={ox + 3 * cell} y={oy + 4 * cell} width={cell * 3} height={cell} fill="#ffe2c4" />
        <rect x={ox + 4 * cell} y={oy + 4 * cell} width={cell} height={cell} fill="#ffb784" />
        <path d={lines.join('')} stroke="#b9ad98" strokeWidth="0.8" />
        <path d={thick.join('')} stroke="#4a4236" strokeWidth="2" />
        <rect x={ox} y={oy} width={cell * 9} height={cell * 9} fill="none" stroke="#4a4236" strokeWidth="2.4" />
        {digits.map(([r, c, d, pen]) => (
          <text
            key={`${r}-${c}`}
            x={ox + c * cell + cell / 2}
            y={oy + r * cell + cell / 2 + 3.6}
            fontSize="10"
            fontWeight={pen ? 600 : 800}
            fill={pen ? '#2f5fbf' : '#2b2724'}
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
          >
            {d}
          </text>
        ))}
      </g>
      <g transform="translate(118 112) rotate(40)">
        <rect x="-5" y="-46" width="10" height="56" rx="1.5" fill="#f2b632" stroke="#7a5a12" strokeWidth="1.2" />
        <rect x="-5" y="-54" width="10" height="9" rx="2" fill="#ef8fa0" stroke="#8a4250" strokeWidth="1.2" />
        <rect x="-5.4" y="-46.5" width="10.8" height="3.5" fill="#c9c3b8" stroke="#6f6a60" strokeWidth="0.8" />
        <path d="M-5 10 L0 22 L5 10 Z" fill="#f3d3a7" stroke="#7a5a12" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M-1.8 17.2 L0 22 L1.8 17.2 Z" fill="#3b3a36" />
      </g>
    </svg>
  );
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="sd-diff-dots" aria-hidden="true">
      {[1, 2, 3, 4].map((k) => (
        <span key={k} className={k <= level ? 'on' : ''} />
      ))}
    </span>
  );
}

export function SudokuSetup({ setup, onSetup, saved, records, busy, onStart, onOpenCode, onResume, onPrint, onBack }: SudokuSetupProps) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const openCode = () => {
    const parsed = parsePuzzleCode(code);
    if (!parsed) {
      setCodeError('문제 번호는 "2-04821"처럼 난이도 숫자(1~4)와 다섯 자리 숫자로 되어 있어요.');
      return;
    }
    setCodeError(null);
    onOpenCode(parsed.difficulty, parsed.seed);
  };

  const savedFilled = saved ? saved.state.values.filter((v) => v).length : 0;

  return (
    <div className="setup sd-setup">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 게임 목록
      </button>
      <header className="sd-hero">
        <SudokuHeroArt />
        <div>
          <h1>스도쿠</h1>
          <p>가로줄·세로줄·굵은 선 3×3 칸마다 1부터 9까지 한 번씩만 들어가요. 빈칸을 모두 채우면 성공!</p>
          <p className="sd-hero-sub">화면에서 풀어도 되고, 문제지를 인쇄해서 연필로 풀어도 좋아요.</p>
        </div>
      </header>

      {saved && (
        <section className="resume-card">
          <div>
            <strong>하던 문제가 있어요.</strong>
            <span>
              {' '}
              {DIFFICULTY_INFO[saved.state.puzzle.difficulty].label} · 문제 번호 {saved.state.puzzle.id} · {savedFilled}/81칸 ·{' '}
              {saved.state.elapsedMs >= 1000 ? `${formatTimeKo(saved.state.elapsedMs)} 동안 풀었어요` : '방금 시작했어요'}
            </span>
          </div>
          <button type="button" className="btn btn-primary" onClick={onResume} data-testid="sd-resume">
            이어하기
          </button>
        </section>
      )}

      <section className="setup-section">
        <h2>난이도</h2>
        <div className="sd-diff-grid" role="radiogroup" aria-label="난이도">
          {DIFFICULTIES.map((d, k) => {
            const info = DIFFICULTY_INFO[d];
            const rec = records[d];
            return (
              <label key={d} className={`sd-diff-card sd-diff-${d}${setup.difficulty === d ? ' is-on' : ''}`} data-testid={`sd-diff-${d}`}>
                <input type="radio" name="sd-difficulty" checked={setup.difficulty === d} onChange={() => onSetup({ ...setup, difficulty: d })} />
                <span className="sd-diff-title">
                  <DifficultyDots level={k + 1} />
                  <strong>{info.label}</strong>
                </span>
                <small>{info.desc}</small>
                <span className="sd-diff-meta">{info.clues}</span>
                <span className="sd-diff-record">
                  {rec.bestMs !== null ? `🏅 최고 ${formatTime(rec.bestMs)}` : '최고 기록 없음'} · {rec.solved}번 풀었어요
                </span>
              </label>
            );
          })}
        </div>
      </section>

      <section className="setup-section">
        <h2>틀린 숫자 표시</h2>
        <div className="rule-grid">
          {MISTAKE_MODES.map((m) => (
            <label key={m.value} className="rule-item">
              <input type="radio" name="sd-mistake" checked={setup.mistakeMode === m.value} onChange={() => onSetup({ ...setup, mistakeMode: m.value })} />
              <span>
                <strong>{m.title}</strong>
                <small>{m.desc}</small>
              </span>
            </label>
          ))}
        </div>
        <p className="sd-help">같은 줄·열·3×3 칸에 같은 숫자가 겹치는 것은 어느 쪽이든 빨갛게 보여 줘요.</p>
      </section>

      <section className="setup-section setup-footer">
        <span className="sd-help">
          {DIFFICULTY_INFO[setup.difficulty].label} · {setup.mistakeMode === 'instant' ? '틀린 숫자 바로 표시' : '다 채운 뒤 확인'}
        </span>
        <button type="button" className="btn btn-primary btn-large" disabled={busy} onClick={() => onStart(setup)} data-testid="sd-start">
          {busy ? '문제를 만드는 중…' : '새 문제 풀기'}
        </button>
      </section>

      <section className="setup-section sd-print-promo">
        <div className="sd-print-promo-text">
          <h2>🖨 문제지 인쇄</h2>
          <p>
            난이도와 한 쪽에 들어갈 문제 수(1·2·4·6개), 쪽수를 골라 A4 문제지를 만들어요. 정답지는 맨 뒤에 작게 모아 줘요. 인쇄하기 전에
            미리보기로 확인할 수 있어요.
          </p>
        </div>
        <button type="button" className="btn btn-large" onClick={onPrint} data-testid="sd-open-print">
          문제지 만들기
        </button>
      </section>

      <section className="setup-section">
        <h2>번호로 문제 열기</h2>
        <div className="sd-code-row">
          <input
            type="text"
            inputMode="numeric"
            placeholder="예: 2-04821"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') openCode();
            }}
            aria-label="문제 번호"
            data-testid="sd-code-input"
          />
          <button type="button" className="btn" onClick={openCode} disabled={busy || code.trim() === ''} data-testid="sd-code-open">
            이 문제 풀기
          </button>
        </div>
        {codeError ? <p className="warn">{codeError}</p> : <p className="sd-help">인쇄한 문제지 아래에 있는 문제 번호를 넣으면 똑같은 문제를 화면에서 풀 수 있어요.</p>}
      </section>

      <details className="how-to">
        <summary>놀이 방법</summary>
        <ol>
          <li>9×9 판은 굵은 선으로 3×3 칸 9개로 나뉘어 있어요. 가로줄 9개, 세로줄 9개, 3×3 칸 9개에 1부터 9까지 한 번씩만 들어가야 해요.</li>
          <li>빈칸을 눌러 고르고(화살표 키로도 옮길 수 있어요) 숫자 버튼이나 숫자키 1~9를 눌러 넣어요. 지우기는 Backspace·Delete·0.</li>
          <li>헷갈리면 메모를 해요: N을 누르거나 ✎ 메모를 켜면 작은 후보 숫자를 적어요. Shift+숫자로도 메모할 수 있어요. 숫자를 넣으면 같은 줄·열·칸의 메모에서 그 숫자가 저절로 지워져요.</li>
          <li>고른 칸의 가로줄·세로줄·3×3 칸과, 같은 숫자가 있는 칸이 함께 밝게 보여요. 숫자 버튼에는 몇 개 남았는지 나와요.</li>
          <li>막히면 💡 힌트(H): 한 칸을 채워 주면서 어떻게 찾는지 알려 줘요. 되돌리기 Ctrl+Z, 다시 하기 Ctrl+Y, 잠깐 쉬기 P.</li>
          <li>쉬운 방법: 어떤 3×3 칸에 아직 없는 숫자 하나를 골라, 그 숫자가 갈 수 있는 칸이 한 곳뿐인지 찾아보세요!</li>
          <li>하던 문제는 저절로 저장돼요. 힌트 없이 푼 가장 빠른 시간이 난이도마다 최고 기록으로 남아요.</li>
        </ol>
      </details>
    </div>
  );
}
