/** 0 이상 1 미만의 수를 돌려주는 난수 함수. 테스트에서는 시드를 고정한 것을 넣는다. */
export type Rng = () => number;

/** 시드를 고정한 난수 (mulberry32). 같은 시드면 항상 같은 순서가 나온다. */
export function seededRandom(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0 이상 n 미만의 정수 */
export function randomInt(n: number, rng: Rng = Math.random): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** 배열에서 하나를 고른다. 빈 배열이면 undefined */
export function pick<T>(items: readonly T[], rng: Rng = Math.random): T | undefined {
  return items.length === 0 ? undefined : items[randomInt(items.length, rng)];
}

/** 섞은 새 배열을 돌려준다 (원본은 그대로). */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
