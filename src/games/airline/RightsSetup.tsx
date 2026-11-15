import './rights.css';
import { ChoiceIcon, ICON_DUO, ICON_LINE, IconPicker, type IconChoice } from '../../components/IconPicker';
import { RIGHTS_MODE_INFO } from './rights';
import type { RightsMode } from './rightsTypes';
import type { AirlineOptions } from './types';

function RightsIconChoice({ kind }: { kind: RightsMode }) {
  return (
    <ChoiceIcon>
      <rect x="8" y="5" width="16" height="22" rx="2.5" {...ICON_DUO} />
      <circle cx="16" cy="14" r="4.5" {...ICON_LINE} />
      {kind === 'off' && <path d="M7 7l18 18" {...ICON_LINE} />}
      {kind === 'simple' && <path d="M12 22h8" {...ICON_LINE} />}
      {kind === 'real' && <path d="M11 21h10M11 24h7" {...ICON_LINE} />}
    </ChoiceIcon>
  );
}

const RIGHTS_CHOICES: IconChoice<RightsMode>[] = (['off', 'simple', 'real'] as const).map((v) => ({
  value: v,
  short: RIGHTS_MODE_INFO[v].name,
  label: RIGHTS_MODE_INFO[v].text,
  icon: <RightsIconChoice kind={v} />,
}));

/** 설정 화면 '규칙'에 붙는 운수권 고르기 (끄기 / 간단히 / 실제처럼, 새 게임 기본은 간단히) */
export function RightsSetup({ opt, setOpt }: { opt: AirlineOptions; setOpt: (patch: Partial<AirlineOptions>) => void }) {
  const rights = opt.rights ?? 'simple';
  return (
    <div className="al-rt-setup">
      <IconPicker caption="운수권" value={rights} options={RIGHTS_CHOICES} onChange={(v) => setOpt({ rights: v })} testId="al-rights-mode" />
      <p className="al-note">🛂 {RIGHTS_MODE_INFO[rights].text}. 시대가 지나면 협정이 넓어지고 ‘하늘 개방 협정’이 되면 제한이 없어져요.</p>
    </div>
  );
}
