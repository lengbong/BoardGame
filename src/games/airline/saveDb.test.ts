import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seededRandom } from '../../lib/random';
import { aiTurn } from './ai';
import { createGame } from './rules';
import { setSaveBackend, type SaveBackend } from './saveDb';
import { clearSavedAirlineGame, exportSaveText, importSaveText, loadSavedAirlineGameAsync, saveAirlineGame, saveFileName, savesSettled, serializeSave } from './storage';
import type { AirlineSetup } from './types';

const KEY = 'family-boardgame.airline.save.v1';

function setup(world: boolean): AirlineSetup {
  return {
    seats: [{ kind: 'human', name: '' }, { kind: world ? 'empty' : 'ai-normal', name: '' }, { kind: 'empty', name: '' }, { kind: 'empty', name: '' }],
    options: { era: 2003, mode: 'years', years: 0, goalValue: 20000, goalRegions: 6, money: 'normal', challenge: null, aiStyle: 'normal', names: 'real', ...(world ? { world: true } : {}) },
    hubs: [null, null, null, null],
    airlines: [world ? 'korean' : null, null, null, null],
  };
}

describe('큰 저장소와 저장 파일', () => {
  let local: Map<string, string>;
  let big: Map<string, string>;
  /** localStorage가 받는 가장 긴 글 (브라우저 한도 흉내) */
  let quota = Infinity;
  const backend: SaveBackend = {
    get: async (k) => big.get(k) ?? null,
    set: async (k, v) => void big.set(k, v),
    del: async (k) => void big.delete(k),
  };

  beforeEach(() => {
    local = new Map();
    big = new Map();
    quota = Infinity;
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => local.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (v.length > quota) throw new Error('QuotaExceededError');
          local.set(k, v);
        },
        removeItem: (k: string) => void local.delete(k),
      },
    };
    setSaveBackend(backend);
  });
  afterEach(() => {
    setSaveBackend(undefined);
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it('localStorage 한도보다 큰 판도 큰 저장소에 저장하고 그대로 읽는다', async () => {
    const st = setup(true);
    const s = createGame(st, seededRandom(1));
    quota = 100; // 본문은 localStorage에 못 들어간다
    expect(serializeSave(st, s).length).toBeGreaterThan(quota);
    saveAirlineGame(st, s);
    await savesSettled();
    expect(big.get(KEY)!.length).toBeGreaterThan(quota);
    // 처음 화면이 '하던 게임'을 알아보게 짧은 표시만 localStorage에 남는다
    expect(local.get(KEY)).toBe('{"idb":true}');
    const back = await loadSavedAirlineGameAsync();
    expect(back).not.toBeNull();
    expect(back!.state.companies).toHaveLength(s.companies.length);
    expect(back!.state.companies[0].name).toBe('대한항공');
    expect(back!.setup.options.world).toBe(true);
  });

  it('여러 번 저장하면 마지막 것이 남고, 지우면 둘 다 없어진다', async () => {
    const st = setup(false);
    const rng = seededRandom(2);
    let s = createGame(st, rng);
    saveAirlineGame(st, s);
    s = aiTurn({ ...s, turnPos: 1 }, rng);
    saveAirlineGame(st, s);
    const back = await loadSavedAirlineGameAsync();
    expect(back!.state.t).toBe(s.t);
    clearSavedAirlineGame();
    await savesSettled();
    expect(big.has(KEY)).toBe(false);
    expect(local.has(KEY)).toBe(false);
    expect(await loadSavedAirlineGameAsync()).toBeNull();
  });

  it('예전에 localStorage에 저장한 판은 읽으면서 큰 저장소로 옮긴다', async () => {
    const st = setup(false);
    const s = createGame(st, seededRandom(3));
    local.set(KEY, serializeSave(st, s));
    const back = await loadSavedAirlineGameAsync();
    expect(back!.state.companies).toHaveLength(2);
    await savesSettled();
    expect(big.has(KEY)).toBe(true);
    expect(local.get(KEY)).toBe('{"idb":true}');
    expect((await loadSavedAirlineGameAsync())!.state.t).toBe(s.t);
  });

  it('큰 저장소가 없으면 예전처럼 localStorage에 저장한다', async () => {
    setSaveBackend(null);
    const st = setup(false);
    const s = createGame(st, seededRandom(4));
    saveAirlineGame(st, s);
    expect(local.get(KEY)!.length).toBeGreaterThan(1000);
    expect((await loadSavedAirlineGameAsync())!.state.t).toBe(s.t);
  });

  it('망가진 저장은 지우고 없는 것으로 읽는다', async () => {
    big.set(KEY, '{oops');
    local.set(KEY, '{"idb":true}');
    expect(await loadSavedAirlineGameAsync()).toBeNull();
    expect(big.has(KEY)).toBe(false);
    expect(local.has(KEY)).toBe(false);
  });

  it('저장 파일: 내려받은 글을 다시 불러오면 같은 판, 다른 파일은 받지 않는다', () => {
    const st = setup(true);
    const s = createGame(st, seededRandom(5));
    const back = importSaveText(exportSaveText(st, s));
    expect(back!.state.t).toBe(s.t);
    expect(back!.state.companies.map((c) => c.name)).toEqual(s.companies.map((c) => c.name));
    expect(importSaveText('안녕')).toBeNull();
    expect(importSaveText('{"setup":{},"state":{}}')).toBeNull();
    expect(importSaveText('[1,2,3]')).toBeNull();
    expect(saveFileName(s)).toBe('haneulgil-airline-2003-01.json');
  });
});
