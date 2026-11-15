import { Fragment } from 'react';
import { JOINT_BONUS, MAX_MEMBERS, MILES_PER_MEMBER, allianceOf, alliesOf } from './alliances';
import { FinIcon, OutlookBars } from './FinanceArt';
import { allianceOutlook, proposeBlocker } from './rules';
import { MoreInfo } from './StaffArt';
import { mLabel } from './time';
import type { AirlineAction, AirlineState } from './types';
import { ActButton, CoName } from './ui';

const notMine = '내 차례에만 할 수 있어요';

/** 재무 화면의 항공 동맹: 우리 동맹(회원·효과·나가기)과 다른 회사에 제안하기 */
export function AlliancePanel({ state, viewer, canAct, perform }: { state: AirlineState; viewer: number; canAct: boolean; perform: (a: AirlineAction) => void }) {
  const mine = allianceOf(state, viewer);
  const allies = alliesOf(state, viewer);
  const full = !!mine && mine.members.length >= MAX_MEMBERS;
  const others = state.companies.map((c, i) => ({ c, i })).filter(({ c, i }) => i !== viewer && !c.out && !mine?.members.includes(i));

  return (
    <>
      <h4 className="al-fin-title">
        <FinIcon kind="rings" /> 항공 동맹 <small>{mine ? `${mine.name} · ${mine.members.length}/${MAX_MEMBERS}곳` : '아직 없어요'}</small>
      </h4>
      {mine && (
        <div className="al-partner">
          <div className="al-alliance-members">
            {mine.members.map((m, k) => (
              <Fragment key={m}>
                {k > 0 && <span className="al-alliance-join" aria-hidden="true">✈</span>}
                <CoName c={state.companies[m]} bold={m === viewer} />
              </Fragment>
            ))}
          </div>
          <small className="al-muted">{mLabel(mine.since)}부터</small>
          <ul className="al-perks">
            <li>
              <FinIcon kind="plane" size={16} /> 동맹 회사들의 노선을 이어 갈아타는 손님을 함께 태워요
            </li>
            <li>
              <FinIcon kind="people" size={16} /> 동맹 회사도 지점이 있는 도시에서 손님 <b className="al-pos">+{Math.round((JOINT_BONUS - 1) * 100)}%</b>
            </li>
            <li>
              <FinIcon kind="star" size={16} /> 동맹 마일리지: 모든 노선 손님 <b className="al-pos">+{(MILES_PER_MEMBER * allies.length * 100).toFixed(1)}%</b>
            </li>
            <li>
              <FinIcon kind="building" size={16} /> 동맹 회사의 라운지가 우리 사업 손님에게도 반쯤 효과가 있어요
            </li>
          </ul>
          <ActButton
            small
            blocker={canAct ? null : notMine}
            onClick={() => {
              if (window.confirm(`${mine.name}에서 나올까요?`)) perform({ type: 'endAlliance' });
            }}
          >
            동맹에서 나오기
          </ActButton>
        </div>
      )}
      {others.length === 0 ? (
        !mine && <p className="al-muted">함께할 회사가 없어요.</p>
      ) : (
        <>
          {mine && <h5 className="al-fin-sub">{full ? '동맹이 다 찼어요' : '동맹에 초대하기'}</h5>}
          <ul className="al-alliance-list">
            {others.map(({ c, i }) => {
              const theirs = allianceOf(state, i);
              const humanSide = c.kind === 'human' || !!theirs?.members.some((m) => state.companies[m].kind === 'human');
              const look = humanSide ? null : allianceOutlook(state, viewer, i);
              const why = canAct ? proposeBlocker(state, viewer, i) : notMine;
              const label = mine ? '초대' : theirs ? '가입 신청' : '동맹 제안';
              return (
                <li key={i}>
                  <CoName c={c} />
                  <small className="al-muted al-outlook-text">
                    {theirs && <span>{theirs.name} · </span>}
                    {look !== null && !(mine && theirs) && <OutlookBars level={look === 'yes' ? 3 : look === 'maybe' ? 2 : 1} />}
                    {mine && theirs ? '다른 동맹이에요' : humanSide ? '사람이 정해요' : look === 'yes' ? '받아들일 것 같아요' : look === 'maybe' ? '반반이에요' : '거절할 것 같아요'}
                  </small>
                  <ActButton small blocker={why} onClick={() => perform({ type: 'propose', to: i })}>
                    {label}
                  </ActButton>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <MoreInfo>
        동맹은 {MAX_MEMBERS}곳까지예요. 동맹이 없는 회사에 제안하면 새 동맹을 만들고, 우리 동맹에 초대하거나 다른 동맹에 가입을 신청할 수도 있어요. 같은 도시에 지점이 많고 겹치는 노선이 적을수록, 크기가 비슷할수록 반겨요 (동맹 회사가
        많으면 더 까다로워요). 석 달에 한 번 제안할 수 있고, 언제든 나올 수 있어요.
      </MoreInfo>
    </>
  );
}
