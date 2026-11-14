import { burst, sfx, tone } from '../../lib/sound';

/** 기차로 전국 일주 효과음 (모두 합성음) */
export const rlSound = {
  /** 창구에서 표가 스르륵 미끄러져 나오는 소리 */
  slip() {
    burst(0, 0.12, 2400, 0.9, 0.16, 5200);
    tone(1320, 0.1, 0.05, 'triangle', 0.05);
  },
  /** 더미에서 뒷면 표 한 장 */
  deck() {
    burst(0, 0.1, 1200, 1, 0.14, 3000);
  },
  /** 기차 칸이 하나씩 놓이며 칙칙폭폭 */
  chug(cars: number, step: number) {
    const gap = Math.max(0.05, step / 1000);
    for (let i = 0; i < Math.min(cars, 6); i++) {
      burst(i * gap, 0.07, 520, 1.6, 0.3, 300);
      burst(i * gap + gap / 2, 0.05, 900, 2, 0.16);
    }
  },
  /** 뿌우 — 기적 소리 */
  whistle(delay = 0) {
    tone(740, delay, 0.5, 'sine', 0.07, 760);
    tone(932, delay, 0.5, 'sine', 0.06, 955);
    tone(740, delay + 0.55, 0.25, 'sine', 0.05);
    tone(932, delay + 0.55, 0.25, 'sine', 0.045);
  },
  /** 관광 도장 쾅! 첫 도장은 더 크게 */
  stamp(first: boolean, delay = 0) {
    tone(150, delay, 0.16, 'sine', first ? 0.3 : 0.2, 60);
    burst(delay, 0.06, 420, 1.2, first ? 0.4 : 0.25);
    if (first) [784, 988, 1175].forEach((f, i) => tone(f, delay + 0.12 + i * 0.07, 0.14, 'triangle', 0.07));
  },
  /** 여행 계획 종이 펼치기 */
  plans() {
    for (let i = 0; i < 3; i++) burst(i * 0.08, 0.12, 700 + i * 200, 0.8, 0.12, 2200);
  },
  /** 계획을 이었을 때 */
  planDone(delay = 0) {
    [659, 784, 988, 1319].forEach((f, i) => tone(f, delay + i * 0.08, 0.2, 'triangle', 0.1));
  },
  /** 마지막 바퀴를 알리는 종 */
  bell() {
    [0, 0.32].forEach((t) => {
      tone(1568, t, 0.6, 'sine', 0.08);
      tone(2093, t, 0.4, 'sine', 0.04);
    });
  },
  select(on: boolean) {
    tone(on ? 1047 : 698, 0, 0.05, 'triangle', 0.05);
  },
  reshuffle() {
    sfx.shuffle();
  },
  pass() {
    tone(392, 0, 0.12, 'sine', 0.06);
  },
  win() {
    sfx.win();
  },
};
