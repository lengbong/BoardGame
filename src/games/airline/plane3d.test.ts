import { describe, expect, it } from 'vitest';
import { MODELS } from './aircraft';
import { SHAPES } from './aircraftShapes';
import { planeImageUrl } from './PlaneImage';
import { NEUTRAL_LIVERY, companyLivery, renderPlaneSvg } from './plane3d';

describe('기종 그림 (SVG)', () => {
  it('모든 기종에 치수가 있다', () => {
    for (const m of MODELS) expect(SHAPES[m.id], m.id).toBeDefined();
  });

  it('모든 기종을 숫자 오류 없이 틀 안에 그린다', () => {
    for (const m of MODELS) {
      const svg = renderPlaneSvg(SHAPES[m.id], NEUTRAL_LIVERY);
      expect(svg, m.id).toMatch(/^<svg [^>]*viewBox="0 0 400 225"/);
      expect(svg, m.id).not.toMatch(/NaN|Infinity/);
      const nums = [...svg.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((x) => [Number(x[1]), Number(x[2])]);
      expect(nums.length, m.id).toBeGreaterThan(200);
      for (const [x, y] of nums) {
        expect(x, m.id).toBeGreaterThanOrEqual(-1);
        expect(x, m.id).toBeLessThanOrEqual(401);
        expect(y, m.id).toBeGreaterThanOrEqual(-1);
        expect(y, m.id).toBeLessThanOrEqual(226);
      }
      // 너무 크지 않게 (한 장에 90KB 아래)
      expect(svg.length, m.id).toBeLessThan(90_000);
    }
  }, 60000);

  it('회사 칠에는 꼬리 무늬와 회사 색이 들어간다', () => {
    const svg = renderPlaneSvg(SHAPES.a320, companyLivery('#e5484d', '#b4282e', 'star'));
    expect(svg).toContain('transform="matrix(');
    expect(svg).toContain('#ffffff');
    expect(svg).not.toBe(renderPlaneSvg(SHAPES.a320, NEUTRAL_LIVERY));
  });

  it('같은 칠은 한 번만 그리고 data URL을 준다', () => {
    const a = planeImageUrl('b747-400');
    expect(a).toMatch(/^data:image\/svg\+xml/);
    expect(planeImageUrl('b747-400')).toBe(a);
    expect(planeImageUrl('b747-400', { main: '#3e63dd', dark: '#2a47a8' })).not.toBe(a);
    expect(planeImageUrl('nope')).toBeUndefined();
  });
});
