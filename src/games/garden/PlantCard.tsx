import type { CSSProperties, KeyboardEvent, MouseEvent, Ref } from 'react';
import { BONUS_LABEL, BONUS_TEXT, KIND_EMOJI, KIND_LABEL, RES, RES_LABEL, SEASON_LABEL } from './cards';
import { PlantPicture, TokenIcon } from './Art';
import type { PlantCard } from './types';

const BONUS_ICON = { water2: '🚿', bee: '🏠', scarecrow: '🎃' } as const;

/** 꽃 모양 점수 표 */
function PointsBadge({ points }: { points: number }) {
  return (
    <span className={`gd-pts${points === 0 ? ' gd-pts-zero' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 32 32">
        {Array.from({ length: 5 }, (_, i) => (
          <ellipse key={i} cx={16} cy={8} rx={6} ry={7.4} transform={`rotate(${i * 72} 16 16)`} />
        ))}
        <circle cx={16} cy={16} r={8.6} className="gd-pts-core" />
      </svg>
      <b>{points}</b>
    </span>
  );
}

/** 카드를 읽어 주는 글 (화면 낭독기·마우스 올리기) */
export function cardDescription(c: PlantCard): string {
  const cost = RES.filter((r) => c.cost[r] > 0)
    .map((r) => `${RES_LABEL[r]} ${c.cost[r]}`)
    .join(', ');
  const bonus = c.bonus ? ` · ${BONUS_LABEL[c.bonus]}: ${BONUS_TEXT[c.bonus]}` : '';
  return `${c.name} (${SEASON_LABEL[c.season]} ${KIND_LABEL[c.kind]}) · 꽃 점수 ${c.points} · 값: ${cost} · 심으면 ${RES_LABEL[c.produce]}을 만들어요${bonus}`;
}

interface PlantCardProps {
  card: PlantCard;
  /** full: 꽃시장 크기, mini: 온실 칸 */
  size?: 'full' | 'mini';
  /** 떨이 표 */
  sale?: boolean;
  /** 지금 심을 수 있다 (반짝임) */
  canBuy?: boolean;
  selected?: boolean;
  /** 지금 차례인 사람이 실제로 낼 토큰 수 (생산·떨이를 뺀 값) */
  price?: number | null;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent) => void;
  onDoubleClick?: () => void;
  testId?: string;
  innerRef?: Ref<HTMLDivElement>;
  /** 버튼처럼 눌러 고를 수 있다 */
  interactive?: boolean;
}

/** 씨앗 봉투 모양의 식물 카드 */
export function PlantCardView({ card: c, size = 'full', sale, canBuy, selected, price, className, style, onClick, onDoubleClick, testId, innerRef, interactive }: PlantCardProps) {
  const cls = ['gd-card', `gd-card-${size}`, `gd-season-${c.season}`, canBuy && 'gd-card-can', selected && 'gd-card-selected', interactive && 'gd-card-click', className].filter(Boolean).join(' ');
  const onKey = (e: KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault();
      e.stopPropagation();
      onClick(e as unknown as MouseEvent);
    }
  };
  const label = `${cardDescription(c)}${sale ? ' · 떨이: 1개 덜 내요' : ''}${price !== undefined && price !== null ? ` · 내 값 ${price}개` : ''}${canBuy ? ' · 지금 심을 수 있어요' : ''}`;
  return (
    <div
      ref={innerRef}
      className={cls}
      style={style}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={interactive ? onKey : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? !!selected : undefined}
      aria-label={label}
      title={label}
      data-testid={testId}
    >
      <div className="gd-card-top">
        {size === 'mini' ? (
          <span className="gd-card-kind gd-card-mininame">{c.name}</span>
        ) : (
          <span className="gd-card-kind">
            <span aria-hidden="true">{KIND_EMOJI[c.kind]}</span> {KIND_LABEL[c.kind]}
          </span>
        )}
        <PointsBadge points={c.points} />
      </div>
      <div className="gd-card-art">
        <PlantPicture art={c.art} className="gd-card-pic" />
        <span className="gd-card-prod" title={`${RES_LABEL[c.produce]}을 만들어요`}>
          <TokenIcon token={c.produce} size={size === 'mini' ? 16 : 22} />
          <span className="gd-card-prod-plus">+</span>
        </span>
        {c.bonus && (
          <span className="gd-card-bonus" title={`${BONUS_LABEL[c.bonus]}: ${BONUS_TEXT[c.bonus]}`}>
            {BONUS_ICON[c.bonus]}
          </span>
        )}
      </div>
      <div className="gd-card-name">{c.name}</div>
      <div className="gd-card-cost">
        {RES.filter((r) => c.cost[r] > 0).map((r) => (
          <span key={r} className="gd-cost-chip">
            <TokenIcon token={r} size={size === 'mini' ? 13 : 17} />
            <b>{c.cost[r]}</b>
          </span>
        ))}
      </div>
      {price !== undefined && price !== null && (
        <span className={`gd-card-price${canBuy ? ' gd-card-price-ok' : ''}`} aria-hidden="true">
          내 값 {price}
        </span>
      )}
      {sale && (
        <span className="gd-sale-tag" aria-hidden="true">
          떨이 -1
        </span>
      )}
    </div>
  );
}

export { BONUS_ICON };
