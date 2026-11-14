import { withJosa } from '../../lib/korean';
import { useMemo, useState } from 'react';
import { PlaneArt } from './Art';
import { gameHub, usableColor } from './brand';
import { CITY, REGIONS, REGION_INFO } from './cities';
import { airlinePhoto } from './images';
import { airlinesAt, type RealAirline } from './realAirlines';
import { hubCandidates } from './rules';
import type { RegionId, StartEra } from './types';
import { IataBadge, Photo } from './ui';

/** 한 항공사의 사진 (없으면 그 항공사 색으로 칠한 옆모습 그림) */
export function AirlinePhoto({ airline, width = 160 }: { airline: RealAirline; width?: number }) {
  const main = usableColor(airline.colors[0]) ?? usableColor(airline.colors[1]) ?? '#6b7a8a';
  return (
    <Photo
      src={airlinePhoto(airline.id)}
      credit={`airlines/${airline.id}`}
      alt={`${airline.name} 비행기 사진`}
      className="al-airline-photo"
      fallback={
        <span className="al-airline-art" style={{ background: `linear-gradient(160deg, ${airline.colors[1] ?? '#dfe7ee'}33, #e9f3f9)` }}>
          <PlaneArt body="narrow" engines={2} color={main} dark={main} shape="circle" width={width * 0.8} title={`${airline.name} 비행기 그림`} />
        </span>
      }
    />
  );
}

/** 'n년~' 또는 'n~m년' */
export function airlineYears(a: RealAirline): string {
  return a.defunct ? `${a.founded}~${a.defunct}년` : `${a.founded}년~`;
}

const norm = (v: string) => v.toLowerCase().replace(/\s+/g, '');

/**
 * 실제 항공사 고르기: 지역으로 거르고 이름·영어 이름·두 글자 부호로 찾는다.
 * 다른 사람이 고른 항공사는 고를 수 없다.
 */
export function AirlinePicker({
  era,
  value,
  takenBy,
  takenHubs,
  onPick,
}: {
  era: StartEra;
  value: string | null;
  /** 다른 사람이 고른 항공사 → 그 사람 이름 */
  takenBy: Record<string, string>;
  /** 다른 사람이 고른 본사 */
  takenHubs: string[];
  onPick: (id: string | null) => void;
}) {
  const [region, setRegion] = useState<RegionId | 'all'>('all');
  const [query, setQuery] = useState('');
  const all = useMemo(() => airlinesAt(era), [era]);
  const cands = useMemo(() => hubCandidates(era), [era]);
  const q = norm(query);
  const list = all
    .filter((a) => region === 'all' || CITY[a.hub]?.region === region || a.region === region)
    .filter((a) => !q || norm(a.name).includes(q) || norm(a.nameEn).includes(q) || norm(a.iata).includes(q))
    .sort((x, y) => Number(norm(y.iata) === q) - Number(norm(x.iata) === q) || x.name.localeCompare(y.name, 'ko'));
  const counts = REGIONS.map((r) => all.filter((a) => (CITY[a.hub]?.region ?? a.region) === r).length);

  return (
    <div className="al-airline-picker" data-testid="al-airline-picker">
      <div className="al-ap-tools">
        <input
          type="search"
          className="al-ap-search"
          placeholder="이름 또는 IATA (예: 대한, KE)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="항공사 찾기"
          data-testid="al-airline-search"
        />
        <div className="al-sort" role="group" aria-label="지역">
          <button type="button" className={`al-chip${region === 'all' ? ' al-on' : ''}`} onClick={() => setRegion('all')}>
            전체 {all.length}
          </button>
          {REGIONS.map((r, i) =>
            counts[i] > 0 ? (
              <button key={r} type="button" className={`al-chip${region === r ? ' al-on' : ''}`} onClick={() => setRegion(r)}>
                {REGION_INFO[r].short} {counts[i]}
              </button>
            ) : null,
          )}
        </div>
        <button type="button" className="btn btn-small" onClick={() => onPick(null)} data-testid="al-airline-auto">
          🎲 저절로 맡기기
        </button>
      </div>
      <p className="al-muted al-ap-note">
        {era}년에 날던 항공사 {all.length}곳 가운데 {list.length}곳. 이름·두 글자 부호(IATA)·칠 색만 빌려 쓰고 로고는 쓰지 않아요. 게임 속 경영과 사건은 모두 지어낸 이야기예요.
      </p>
      {list.length === 0 ? (
        <p className="al-muted al-empty-main">찾는 항공사가 없어요. 다른 이름이나 지역으로 찾아보세요.</p>
      ) : (
        <ul className="al-ap-grid" role="radiogroup" aria-label="항공사">
          {list.map((a) => {
            const who = takenBy[a.id];
            const hub = gameHub(a, cands, takenHubs);
            const moved = hub && hub !== a.hub;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={value === a.id}
                  className={`al-ap-card${value === a.id ? ' al-on' : ''}`}
                  disabled={!!who}
                  onClick={() => onPick(a.id)}
                  data-testid={`al-airline-${a.id}`}
                >
                  <AirlinePhoto airline={a} />
                  <span className="al-ap-text">
                    <span className="al-ap-name">
                      <IataBadge airline={a} />
                      <b>{a.name}</b>
                    </span>
                    <small className="al-muted">{a.nameEn}</small>
                    <small>
                      {airlineYears(a)} · 본거지 {CITY[a.hub]?.name ?? a.hub}
                      {moved && hub ? ` → 게임에서는 ${CITY[hub].name}` : ''}
                    </small>
                    {a.note && <small className="al-ap-desc">{a.note}</small>}
                    {who && <span className="al-flag al-flag-warn">{withJosa(who, '이/가')} 골랐어요</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
