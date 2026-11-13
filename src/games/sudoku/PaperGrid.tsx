import { memo, type ReactNode } from 'react';
import { strokeMm } from './print';

interface PaperGridProps {
  /** 81글자 문제 ('.' = 빈칸) */
  givens: string;
  /** 정답지: 81글자 정답 (주어진 숫자는 굵게, 나머지는 보통 굵기) */
  solution?: string;
  /** 내가 푼 숫자도 함께 (81칸, 0 = 빈칸): 회색으로 */
  progress?: readonly number[];
  /** 인쇄될 크기 (mm). 화면 미리보기는 --mm 변수로 줄여서 그린다. */
  sizeMm: number;
  /** 아직 만드는 중인 칸 */
  pending?: boolean;
  label?: string;
}

const CELL = 10;
const SIDE = CELL * 9;

/** 인쇄용 판: 흰 바탕에 검은 선과 숫자만 쓰는 벡터 그림 (다크 모드와 상관없이 항상 같은 색) */
export const PaperGrid = memo(function PaperGrid({ givens, solution, progress, sizeMm, pending, label }: PaperGridProps) {
  const { thin, thick } = strokeMm(sizeMm);
  const unitsPerMm = SIDE / sizeMm;
  const tw = thin * unitsPerMm;
  const th = thick * unitsPerMm;
  let thinPath = '';
  let thickPath = '';
  for (let k = 1; k < 9; k++) {
    const p = k * CELL;
    const seg = `M${p} 0V${SIDE}M0 ${p}H${SIDE}`;
    if (k % 3 === 0) thickPath += seg;
    else thinPath += seg;
  }
  const fontSize = solution ? 6.0 : 6.3;
  const baseline = fontSize * 0.36;
  const digits: ReactNode[] = [];
  for (let i = 0; i < 81; i++) {
    const g = givens.charCodeAt(i) - 48;
    const isGiven = g >= 1 && g <= 9;
    const v = isGiven ? g : solution ? solution.charCodeAt(i) - 48 : progress ? progress[i] : 0;
    if (!v) continue;
    const x = (i % 9) * CELL + CELL / 2;
    const y = Math.floor(i / 9) * CELL + CELL / 2 + baseline;
    digits.push(
      <text
        key={i}
        x={x}
        y={y}
        fontSize={fontSize}
        fontWeight={isGiven ? 800 : solution ? 400 : 500}
        fill={isGiven || solution ? '#000' : '#6b6b6b'}
        fontStyle={!isGiven && !solution ? 'italic' : undefined}
      >
        {v}
      </text>,
    );
  }
  return (
    <svg
      className="sd-paper-grid"
      viewBox={`${-th / 2} ${-th / 2} ${SIDE + th} ${SIDE + th}`}
      style={{ width: `calc(var(--mm) * ${sizeMm})`, height: `calc(var(--mm) * ${sizeMm})` }}
      role="img"
      aria-label={label ?? '스도쿠 문제'}
    >
      <rect x={0} y={0} width={SIDE} height={SIDE} fill="#fff" />
      <path d={thinPath} stroke="#000" strokeWidth={tw} fill="none" />
      <path d={thickPath} stroke="#000" strokeWidth={th} fill="none" strokeLinecap="square" />
      <rect x={0} y={0} width={SIDE} height={SIDE} stroke="#000" strokeWidth={th} fill="none" />
      <g textAnchor="middle" fontFamily="'Pretendard', 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Segoe UI', Arial, sans-serif">
        {digits}
      </g>
      {pending && (
        <text x={SIDE / 2} y={SIDE / 2 + 1.5} fontSize={4.2} textAnchor="middle" fill="#888">
          만드는 중…
        </text>
      )}
    </svg>
  );
});
