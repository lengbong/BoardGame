import { burst, sfx, tone } from '../../lib/sound';

/** 우리 마을 지도 효과음 (모두 합성음). 나무 조각 톡, 깃발 펄럭, 가야금 같은 완성 소리 */
export const vlSound = {
  /** 조각을 고르거나 돌릴 때: 작은 딸깍 */
  tick() {
    tone(1250, 0, 0.035, 'triangle', 0.045);
  },
  rotate() {
    burst(0, 0.04, 3200, 2.5, 0.12);
    tone(880, 0.01, 0.05, 'triangle', 0.04, 1100);
  },
  /** 나무 조각을 톡 내려놓는 소리 */
  tap() {
    burst(0, 0.05, 1400, 3, 0.32);
    tone(240, 0, 0.09, 'triangle', 0.13, 150);
    tone(520, 0.005, 0.05, 'sine', 0.05);
  },
  /** 깃발 펄럭 */
  flag() {
    for (let i = 0; i < 4; i++) burst(i * 0.05, 0.06, 900 + i * 350, 1.6, 0.16, 2600);
    tone(660, 0.12, 0.1, 'triangle', 0.06);
    tone(990, 0.2, 0.16, 'triangle', 0.06);
  },
  /** 장승 점수: 나무를 두 번 똑똑 */
  jangseung(points: number) {
    tone(330, 0, 0.08, 'square', 0.04, 260);
    tone(330, 0.12, 0.08, 'square', 0.04, 260);
    if (points > 0) [587, 740, 880].slice(0, points).forEach((f, i) => tone(f, 0.26 + i * 0.09, 0.16, 'triangle', 0.08));
  },
  /** 지형 완성: 가야금처럼 퉁기는 오음 음계 (점수를 받은 사람이 없으면 짧게) */
  complete(kind: 'path' | 'stream' | 'paddy', scored: boolean) {
    const base = { path: [392, 440, 523, 587, 659], stream: [440, 523, 587, 659, 784], paddy: [330, 392, 440, 523, 587] }[kind];
    const notes = scored ? base : base.slice(0, 2);
    notes.forEach((f, i) => {
      tone(f, i * 0.075, 0.42, 'triangle', 0.1);
      tone(f * 2, i * 0.075, 0.12, 'sine', 0.03);
    });
    if (scored) tone(base[4] * 2, notes.length * 0.075 + 0.05, 0.5, 'sine', 0.05);
  },
  /** 놓을 곳이 없어 버릴 때 */
  discard() {
    sfx.noMove();
    burst(0.1, 0.18, 700, 1, 0.14, 2200);
  },
  /** 끝날 때 미완성 지형 점수: 작게 */
  final() {
    tone(587, 0, 0.16, 'triangle', 0.06);
    tone(784, 0.08, 0.2, 'triangle', 0.05);
  },
  win() {
    sfx.win();
  },
};
