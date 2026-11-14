import { burst, sfx, tone } from '../../lib/sound';

/** 하늘길 항공사 효과음 (모두 합성음) */
export const alSound = {
  /** 공항 안내 방송 같은 띵-동 (노선 열기, 차례 알림) */
  chime() {
    tone(988, 0, 0.5, 'sine', 0.07);
    tone(784, 0.28, 0.7, 'sine', 0.07);
  },
  /** 이륙: 엔진 소리가 커지며 떠오른다 */
  takeoff() {
    burst(0, 0.9, 300, 0.7, 0.16, 1800);
    tone(140, 0, 0.9, 'sawtooth', 0.025, 320);
  },
  /** 비행기를 들일 때: 도장 쾅 + 짤랑 */
  stamp() {
    burst(0, 0.06, 900, 2, 0.35);
    tone(160, 0, 0.12, 'triangle', 0.14, 90);
    [784, 1047].forEach((f, i) => tone(f, 0.12 + i * 0.07, 0.15, 'triangle', 0.07));
  },
  /** 지점 열기: 문 열리는 딸랑 */
  bell() {
    [1319, 1568, 1319].forEach((f, i) => tone(f, i * 0.09, 0.18, 'sine', 0.05));
  },
  /** 돈이 들어올 때 */
  coins() {
    sfx.coin();
  },
  /** 돈이 나갈 때 */
  pay() {
    sfx.pay();
  },
  /** 분기 결산: 서류 넘기는 소리 + 화음 */
  report(good: boolean) {
    burst(0, 0.16, 1200, 1.2, 0.18, 3200);
    const notes = good ? [523, 659, 784] : [523, 622, 740];
    notes.forEach((f, i) => tone(f, 0.18 + i * 0.08, 0.3, 'triangle', 0.07));
  },
  /** 뉴스 속보: 타자기 따닥 */
  news() {
    for (let i = 0; i < 5; i++) burst(i * 0.06, 0.03, 2400, 3, 0.18);
    tone(1175, 0.33, 0.12, 'square', 0.03);
  },
  select() {
    tone(980, 0, 0.04, 'triangle', 0.05);
  },
  nope() {
    sfx.noMove();
  },
  bankrupt() {
    sfx.bankrupt();
  },
  win() {
    sfx.win();
  },
};
