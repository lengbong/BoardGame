export type Speed = 'normal' | 'fast' | 'turbo';

export const SPEEDS: Speed[] = ['normal', 'fast', 'turbo'];

export const SPEED_LABELS: Record<Speed, string> = {
  normal: '보통',
  fast: '빠르게',
  turbo: '아주 빠르게',
};

export function parseSpeed(value: unknown): Speed {
  return value === 'fast' || value === 'turbo' ? value : 'normal';
}
