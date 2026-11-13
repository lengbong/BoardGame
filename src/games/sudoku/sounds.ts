import { burst, sfx, tone } from '../../lib/sound';

/** 스도쿠 효과음: 조용히 생각하는 게임이라 모두 작고 부드럽게 */
export const sdSfx = {
  /** 숫자를 놓을 때: 나무 블록을 톡 놓는 소리 */
  place(digit = 5) {
    const f = 520 + digit * 18;
    tone(f, 0, 0.09, 'sine', 0.07, f * 0.94);
    burst(0, 0.03, 1800, 3, 0.05);
  },
  /** 메모: 연필로 톡 */
  note(on = true) {
    tone(on ? 1480 : 1180, 0, 0.04, 'sine', 0.035);
    burst(0, 0.025, 4200, 5, 0.035);
  },
  erase() {
    burst(0, 0.12, 2400, 1.2, 0.06, 900);
  },
  /** 틀리거나 겹칠 때: 낮고 짧게, 놀라지 않게 */
  error() {
    tone(330, 0, 0.14, 'sine', 0.07, 300);
    tone(262, 0.11, 0.2, 'sine', 0.06, 240);
  },
  /** 고칠 수 없는 칸을 눌렀을 때 */
  blocked() {
    tone(196, 0, 0.08, 'triangle', 0.05);
  },
  /** 가로줄·세로줄·3×3 칸을 다 채웠을 때: 반짝 */
  unit(count = 1) {
    const notes = [784, 988, 1175, 1568];
    for (let k = 0; k < Math.min(4, 2 + count); k++) tone(notes[k], 0.05 + k * 0.06, 0.22, 'sine', 0.045);
  },
  hint() {
    [880, 1109, 1319, 1760].forEach((f, k) => tone(f, k * 0.05, 0.25, 'sine', 0.04));
  },
  undo() {
    tone(700, 0, 0.06, 'sine', 0.04, 560);
  },
  redo() {
    tone(560, 0, 0.06, 'sine', 0.04, 700);
  },
  fill() {
    for (let k = 0; k < 6; k++) burst(k * 0.03, 0.025, 3800 + k * 200, 5, 0.03);
  },
  /** 다 채웠는데 틀린 칸이 있을 때 */
  check() {
    tone(392, 0, 0.16, 'triangle', 0.06);
    tone(330, 0.15, 0.24, 'triangle', 0.06);
  },
  complete() {
    sfx.win();
  },
};
