import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useElementWidth } from '../../lib/useElementWidth';
import { DIFFICULTIES, DIFFICULTY_INFO, getPuzzle, hasCachedPuzzle, puzzleCode, randomSeed } from './generator';
import { MAX_PAGES, PER_PAGE_CHOICES, clampPages, planSheets, problemLayout, puzzleSpecs, type PerPage, type PrintDifficulty, type PrintOptions } from './print';
import { PrintPortal, Sheets, type PrintItem } from './PrintSheets';
import { enterPrintMode, exitPrintMode, printWithMode } from './printing';
import { loadPrintOptions, savePrintOptions } from './storage';
import type { Puzzle } from './types';

const DIFF_CHOICES: { value: PrintDifficulty; label: string }[] = [
  ...DIFFICULTIES.map((d) => ({ value: d as PrintDifficulty, label: DIFFICULTY_INFO[d].label })),
  { value: 'mixed', label: '섞어서' },
];

/** 한 쪽에 문제를 어떻게 놓는지 보여 주는 작은 그림 */
function LayoutIcon({ perPage }: { perPage: PerPage }) {
  const { cols, rows } = problemLayout(perPage);
  const w = 30;
  const h = 40;
  const cells = [];
  const cw = (w - 6) / cols;
  const ch = (h - 6) / rows;
  const s = Math.min(cw, ch) - 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(<rect key={`${r}-${c}`} x={3 + c * cw + (cw - s) / 2} y={3 + r * ch + (ch - s) / 2} width={s} height={s} rx="0.8" />);
    }
  }
  return (
    <svg className="sd-layout-icon" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <rect x="0.5" y="0.5" width={w - 1} height={h - 1} rx="2" className="sd-layout-paper" />
      <g className="sd-layout-grid">{cells}</g>
    </svg>
  );
}

export function PrintStudio({ onBack }: { onBack: () => void }) {
  const [opts, setOpts] = useState<PrintOptions>(loadPrintOptions);
  const [pagesText, setPagesText] = useState(String(opts.pages));
  const [baseSeed, setBaseSeed] = useState(() => randomSeed());
  const [puzzles, setPuzzles] = useState<(Puzzle | null)[]>([]);
  const [zoom, setZoom] = useState<'small' | 'large'>('small');
  const previewRef = useRef<HTMLDivElement>(null);
  const previewWidth = useElementWidth(previewRef);

  useEffect(() => savePrintOptions(opts), [opts]);

  const specs = useMemo(
    () => puzzleSpecs({ difficulty: opts.difficulty, perPage: opts.perPage, pages: opts.pages }, baseSeed),
    [opts.difficulty, opts.perPage, opts.pages, baseSeed],
  );

  // 문제를 조금씩 나눠 만들어서 화면이 멈추지 않게 한다.
  useEffect(() => {
    let cancelled = false;
    const result: (Puzzle | null)[] = specs.map((s) => (hasCachedPuzzle(s.difficulty, s.seed) ? getPuzzle(s.difficulty, s.seed) : null));
    setPuzzles([...result]);
    if (result.every(Boolean)) return;
    let timer = 0;
    const run = () => {
      if (cancelled) return;
      const start = performance.now();
      for (let k = 0; k < specs.length; k++) {
        if (result[k]) continue;
        result[k] = getPuzzle(specs[k].difficulty, specs[k].seed);
        if (performance.now() - start > 40) break;
      }
      setPuzzles([...result]);
      if (!result.every(Boolean)) timer = window.setTimeout(run, 0);
    };
    timer = window.setTimeout(run, 20);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [specs]);

  const items: PrintItem[] = useMemo(
    () =>
      specs.map((s, k) => {
        const p = puzzles[k];
        // 설정을 바꾼 직후에는 이전 문제가 남아 있을 수 있으니 번호가 맞는 것만 쓴다.
        return { difficulty: s.difficulty, seed: s.seed, puzzle: p && p.id === puzzleCode(s.difficulty, s.seed) ? p : null };
      }),
    [specs, puzzles],
  );
  const done = items.filter((it) => it.puzzle).length;
  const ready = done === items.length && items.length > 0;
  const plans = planSheets(items.length, opts.perPage, opts.answers);
  const problemPages = plans.filter((p) => p.kind === 'problems').length;
  const answerPages = plans.length - problemPages;

  // Ctrl+P로 인쇄해도 문제지가 나오게
  const readyRef = useRef(ready);
  readyRef.current = ready;
  useEffect(() => {
    const before = () => {
      if (readyRef.current) enterPrintMode();
    };
    const after = () => exitPrintMode();
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
      exitPrintMode();
    };
  }, []);

  const set = (patch: Partial<PrintOptions>) => setOpts((o) => ({ ...o, ...patch }));
  const setPages = (n: number) => {
    const p = clampPages(n);
    setPagesText(String(p));
    set({ pages: p });
  };

  const mm = zoom === 'small' ? 1.15 : Math.max(1.15, Math.min(2.9, ((previewWidth || 700) - 40) / 210));

  return (
    <div className="sd-studio" data-testid="sd-studio">
      <button type="button" className="btn btn-ghost setup-back" onClick={onBack}>
        ← 스도쿠
      </button>
      <header className="sd-studio-head">
        <h1>🖨 문제지 인쇄</h1>
        <p>A4 종이에 맞춘 문제지를 만들어요. 미리보기를 보고 마음에 들면 인쇄하기를 누르세요.</p>
      </header>

      <div className="sd-studio-body">
        <aside className="sd-studio-options">
          <fieldset className="sd-field">
            <legend>난이도</legend>
            <div className="sd-seg" role="radiogroup" aria-label="난이도">
              {DIFF_CHOICES.map((c) => (
                <label key={c.value} className={`sd-seg-item${opts.difficulty === c.value ? ' is-on' : ''}`} data-testid={`sd-pr-diff-${c.value}`}>
                  <input type="radio" name="sd-pr-diff" checked={opts.difficulty === c.value} onChange={() => set({ difficulty: c.value })} />
                  {c.label}
                </label>
              ))}
            </div>
            {opts.difficulty === 'mixed' && <p className="sd-help">쉬움·보통·어려움·아주 어려움을 돌아가며 넣고, 한 쪽 안에서는 쉬운 문제부터 놓아요.</p>}
          </fieldset>

          <fieldset className="sd-field">
            <legend>한 쪽에 몇 문제?</legend>
            <div className="sd-seg sd-seg-layout" role="radiogroup" aria-label="한 쪽에 들어갈 문제 수">
              {PER_PAGE_CHOICES.map((n) => (
                <label key={n} className={`sd-seg-item${opts.perPage === n ? ' is-on' : ''}`} data-testid={`sd-pr-per-${n}`}>
                  <input type="radio" name="sd-pr-per" checked={opts.perPage === n} onChange={() => set({ perPage: n })} />
                  <LayoutIcon perPage={n} />
                  {n}개
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="sd-field">
            <legend>몇 쪽?</legend>
            <div className="sd-stepper">
              <button type="button" className="btn" onClick={() => setPages(opts.pages - 1)} disabled={opts.pages <= 1} aria-label="한 쪽 줄이기">
                −
              </button>
              <input
                type="number"
                min={1}
                max={MAX_PAGES}
                value={pagesText}
                onChange={(e) => {
                  setPagesText(e.target.value);
                  const n = Number(e.target.value);
                  if (e.target.value !== '' && Number.isFinite(n)) set({ pages: clampPages(n) });
                }}
                onBlur={() => setPagesText(String(opts.pages))}
                aria-label="문제 쪽수"
                data-testid="sd-pr-pages"
              />
              <button type="button" className="btn" onClick={() => setPages(opts.pages + 1)} disabled={opts.pages >= MAX_PAGES} aria-label="한 쪽 늘리기">
                ＋
              </button>
              <span className="sd-stepper-total">
                쪽 → 문제 <b>{items.length}</b>개
              </span>
            </div>
          </fieldset>

          <fieldset className="sd-field">
            <legend>더 넣을 것</legend>
            <label className="rule-item">
              <input type="checkbox" checked={opts.answers} onChange={(e) => set({ answers: e.target.checked })} data-testid="sd-pr-answers" />
              <span>
                <strong>정답지</strong>
                <small>문제 쪽을 다 인쇄한 뒤 맨 뒤에 작은 정답판을 모아서 넣어요.</small>
              </span>
            </label>
            <label className="rule-item">
              <input type="checkbox" checked={opts.header} onChange={(e) => set({ header: e.target.checked })} data-testid="sd-pr-header" />
              <span>
                <strong>제목과 이름·날짜 칸</strong>
                <small>쪽마다 맨 위에 제목과 이름·날짜를 쓰는 줄을 넣어요.</small>
              </span>
            </label>
            {opts.header && (
              <input
                type="text"
                className="sd-title-input"
                value={opts.title}
                maxLength={40}
                onChange={(e) => set({ title: e.target.value })}
                aria-label="문제지 제목"
                placeholder="스도쿠 문제지"
              />
            )}
          </fieldset>

          <div className="sd-studio-actions">
            <button type="button" className="btn" onClick={() => setBaseSeed(randomSeed())} data-testid="sd-pr-reroll">
              🔀 다른 문제로 바꾸기
            </button>
            {!ready && (
              <div className="sd-progress" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} data-testid="sd-pr-progress">
                <div className="sd-progress-bar" style={{ '--p': items.length ? done / items.length : 0 } as CSSProperties} />
                <span>
                  문제를 만드는 중… {done} / {items.length}
                </span>
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary btn-large"
              disabled={!ready}
              onClick={() => printWithMode()}
              data-testid="sd-pr-print"
            >
              🖨 인쇄하기 ({plans.length}쪽)
            </button>
            <p className="sd-help">인쇄 창에서 용지는 A4, 배율은 ‘기본값’(100%)으로 해 주세요. ‘머리글과 바닥글’을 끄면 더 깔끔해요.</p>
          </div>
        </aside>

        <section className="sd-studio-preview" aria-label="인쇄 미리보기">
          <div className="sd-preview-bar">
            <strong>미리보기</strong>
            <span data-testid="sd-pr-summary">
              모두 {plans.length}쪽 (문제 {problemPages}쪽{answerPages > 0 ? ` + 정답 ${answerPages}쪽` : ''})
            </span>
            {!ready && (
              <div className="sd-progress sd-progress-inline" aria-hidden="true">
                <div className="sd-progress-bar" style={{ '--p': items.length ? done / items.length : 0 } as CSSProperties} />
                <span>
                  만드는 중 {done}/{items.length}
                </span>
              </div>
            )}
            <button type="button" className="btn btn-primary btn-small" disabled={!ready} onClick={() => printWithMode()} data-testid="sd-pr-print-top">
              🖨 인쇄하기
            </button>
            <div className="sd-seg sd-seg-small" role="radiogroup" aria-label="미리보기 크기">
              <label className={`sd-seg-item${zoom === 'small' ? ' is-on' : ''}`}>
                <input type="radio" name="sd-zoom" checked={zoom === 'small'} onChange={() => setZoom('small')} />
                작게
              </label>
              <label className={`sd-seg-item${zoom === 'large' ? ' is-on' : ''}`}>
                <input type="radio" name="sd-zoom" checked={zoom === 'large'} onChange={() => setZoom('large')} />
                크게
              </label>
            </div>
          </div>
          <div ref={previewRef} className="sd-preview" style={{ '--mm': `${mm}px` } as CSSProperties}>
            <Sheets items={items} perPage={opts.perPage} answers={opts.answers} header={opts.header} title={opts.title} paper />
          </div>
        </section>
      </div>
      {ready && <PrintPortal items={items} perPage={opts.perPage} answers={opts.answers} header={opts.header} title={opts.title} />}
    </div>
  );
}
