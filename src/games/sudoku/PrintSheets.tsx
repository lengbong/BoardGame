import { Fragment, memo, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { DIFFICULTY_INFO, puzzleCode } from './generator';
import { PaperGrid } from './PaperGrid';
import { answerGridMm, answerLayout, planSheets, problemGridMm, problemLayout, type PerPage, type SheetPlan } from './print';
import type { Difficulty, Puzzle } from './types';

/** 인쇄할 문제 하나 */
export interface PrintItem {
  difficulty: Difficulty;
  seed: number;
  /** 아직 만드는 중이면 null */
  puzzle: Puzzle | null;
  /** 내가 푼 숫자도 함께 인쇄할 때 (81칸) */
  progress?: readonly number[];
}

export interface SheetsProps {
  items: readonly PrintItem[];
  perPage: PerPage;
  answers: boolean;
  header: boolean;
  title: string;
}

const EMPTY_GRID = '.'.repeat(81);

const mm = (n: number) => `calc(var(--mm) * ${n.toFixed(2)})`;

function SheetFooter({ page, total, note }: { page: number; total: number; note: string }) {
  return (
    <footer className="sd-sheet-foot">
      <span>{note}</span>
      <span>
        {page} / {total}
      </span>
    </footer>
  );
}

function ProblemSheet({ plan, total, items, perPage, header, title }: SheetsProps & { plan: SheetPlan; total: number }) {
  const { cols, rows } = problemLayout(perPage);
  const size = problemGridMm(perPage, header);
  const caption = Math.min(4.6, Math.max(3.2, size * 0.042));
  return (
    <section className={`sd-sheet sd-sheet-p${perPage}`} style={{ '--cols': cols, '--rows': rows } as CSSProperties}>
      {header && (
        <header className="sd-sheet-head">
          <div>
            <div className="sd-sheet-title">{title.trim() || '스도쿠 문제지'}</div>
            <div className="sd-sheet-rule">가로줄·세로줄·굵은 선 3×3 칸마다 1부터 9까지 한 번씩 들어가요.</div>
          </div>
          <div className="sd-sheet-blanks">
            <span>이름</span>
            <i />
            <span>날짜</span>
            <i className="sd-blank-short" />
          </div>
        </header>
      )}
      <div className="sd-sheet-body">
        {plan.indices.map((idx) => {
          const it = items[idx];
          const code = puzzleCode(it.difficulty, it.seed);
          return (
            <figure className="sd-slot" key={idx}>
              <PaperGrid
                givens={it.puzzle?.givens ?? EMPTY_GRID}
                progress={it.progress}
                sizeMm={size}
                pending={!it.puzzle}
                label={`${idx + 1}번 문제 (${DIFFICULTY_INFO[it.difficulty].label}, 문제 번호 ${code})`}
              />
              <figcaption style={{ width: mm(size), fontSize: mm(caption) }}>
                <span>
                  <b>{idx + 1}번</b> · {DIFFICULTY_INFO[it.difficulty].label}
                </span>
                <span>문제 번호 {code}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
      <SheetFooter page={plan.page} total={total} note="문제 번호를 스도쿠 화면의 ‘번호로 문제 열기’에 넣으면 같은 문제를 화면에서 풀 수 있어요." />
    </section>
  );
}

function AnswerSheet({ plan, total, items }: SheetsProps & { plan: SheetPlan; total: number }) {
  const { cols, rows } = answerLayout(items.length);
  const size = answerGridMm(items.length);
  const caption = Math.min(4.2, Math.max(2.6, size * 0.07));
  return (
    <section className="sd-sheet sd-sheet-answers" style={{ '--cols': cols, '--rows': rows } as CSSProperties}>
      <header className="sd-sheet-head sd-sheet-head-small">
        <div className="sd-sheet-title">정답</div>
        <div className="sd-sheet-rule">굵은 숫자는 처음부터 있던 숫자예요. 번호를 보고 맞춰 보세요.</div>
      </header>
      <div className="sd-sheet-body">
        {plan.indices.map((idx) => {
          const it = items[idx];
          const code = puzzleCode(it.difficulty, it.seed);
          return (
            <figure className="sd-slot sd-slot-answer" key={idx}>
              <figcaption style={{ width: mm(size), fontSize: mm(caption) }}>
                <b>{idx + 1}번</b>
                <span>{code}</span>
              </figcaption>
              <PaperGrid
                givens={it.puzzle?.givens ?? EMPTY_GRID}
                solution={it.puzzle?.solution}
                sizeMm={size}
                pending={!it.puzzle}
                label={`${idx + 1}번 정답 (문제 번호 ${code})`}
              />
            </figure>
          );
        })}
      </div>
      <SheetFooter page={plan.page} total={total} note="정답" />
    </section>
  );
}

/** 모든 쪽: 문제 쪽들 다음에 정답 쪽들. paper면 화면 미리보기용 종이 모양으로 감싼다. */
export const Sheets = memo(function Sheets(props: SheetsProps & { paper?: boolean }) {
  const plans = planSheets(props.items.length, props.perPage, props.answers);
  return (
    <>
      {plans.map((plan) => {
        const sheet =
          plan.kind === 'problems' ? (
            <ProblemSheet {...props} plan={plan} total={plans.length} />
          ) : (
            <AnswerSheet {...props} plan={plan} total={plans.length} />
          );
        if (!props.paper) return <Fragment key={plan.page}>{sheet}</Fragment>;
        return (
          <div className="sd-paper" key={plan.page} data-testid="sd-preview-page" aria-label={`${plan.page}쪽 미리보기`}>
            {sheet}
            <span className="sd-paper-tag">
              {plan.page}쪽 · {plan.kind === 'problems' ? '문제' : '정답'}
            </span>
          </div>
        );
      })}
    </>
  );
});

/** 인쇄할 때만 보이는 종이들. body 바로 아래에 두어서 인쇄할 때 나머지 화면을 통째로 숨길 수 있게 한다. */
export function PrintPortal(props: SheetsProps) {
  return createPortal(
    <div className="sd-print-root" aria-hidden="true" data-testid="sd-print-root">
      <Sheets {...props} />
    </div>,
    document.body,
  );
}
