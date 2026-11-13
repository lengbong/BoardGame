import { burst, sfx, tone } from '../../lib/sound';

/** 사목 효과음 (WebAudio 합성음) */
export const fourLineSfx = {
  /** 돌이 떨어지기 시작할 때 스르륵 */
  slide() {
    burst(0, 0.12, 1800, 1.2, 0.08, 700);
  },
  /** 바닥(또는 아래 돌)에 쿵 닿는 소리. at초 뒤 */
  thud(at = 0, row = 5) {
    const low = 95 + (5 - row) * 12;
    tone(low * 1.6, at, 0.14, 'sine', 0.32, low);
    burst(at, 0.06, 900, 1.1, 0.32);
    tone(1500 + row * 60, at, 0.04, 'triangle', 0.05);
    // 작게 한 번 더 튀는 소리
    tone(low * 2.2, at + 0.11, 0.07, 'sine', 0.1, low * 1.4);
  },
  /** 열 고르기 (키보드) */
  tick() {
    tone(1180, 0, 0.035, 'sine', 0.035);
  },
  /** 넷을 이은 순간 반짝이는 소리 */
  line(at = 0) {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, at + i * 0.08, 0.18, 'triangle', 0.08));
  },
  win() {
    sfx.win();
  },
  lose() {
    [440, 392, 349, 294].forEach((f, i) => tone(f, i * 0.15, i === 3 ? 0.4 : 0.16, 'triangle', 0.08));
  },
  draw() {
    sfx.finish();
  },
  undo() {
    tone(700, 0, 0.08, 'sine', 0.06, 560);
    tone(560, 0.07, 0.12, 'sine', 0.06, 420);
  },
};
