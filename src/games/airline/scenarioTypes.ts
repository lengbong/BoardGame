/**
 * 역사 시나리오의 진행 (state.scenario, scenarios.ts·scenarioRules.ts). 저장 판 번호는 그대로(4판)이고
 * 이 값은 선택이에요: 예전 저장·다른 방식의 게임에는 없어요.
 */
export interface ScenarioProgress {
  /** 시나리오 id (scenarios.ts) */
  id: string;
  /** 시나리오를 하는 회사 (늘 0번 회사) */
  company: number;
  /** 끝나는 달 (이 달 결산이 마지막) */
  deadline: number;
  /** 단계마다 이룬 달 (아직이면 null). 단계는 차례대로 이룬다 */
  done: (number | null)[];
  /** 끝났을 때 받은 별 0~3 (끝나기 전에는 없다) */
  stars?: number;
  /** 끝났을 때 덤 목표를 이뤘는지 */
  bonus?: boolean;
}
