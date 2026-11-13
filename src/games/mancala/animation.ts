import { isStore } from './rules';
import type { MancalaEvent, Side } from './types';

/**
 * 마지막 수의 연출 순서를 만든다 (화면과 상관없는 순수 함수라 테스트할 수 있다).
 * 씨앗마다 번호가 있어서, 한 알씩 옮겨 가는 동안 색이 바뀌지 않는다.
 */

/** 손에 쥐고 옮기는 씨앗 묶음. key가 바뀔 때마다 from → at 으로 한 번 날아간다. */
export interface Hand {
  ids: number[];
  from: number;
  at: number;
  key: number;
  /** 한 번 옮겨 가는 데 걸리는 시간 (ms) */
  dur: number;
}

/** 창고로 날아가는 씨앗 (가져오기·끝 정리) */
export interface Flyer {
  key: number;
  seed: number;
  from: number;
  fromSlot: number;
  to: number;
  toSlot: number;
  delay: number;
  dur: number;
}

export type CalloutKind = 'extra' | 'capture' | 'sweep';

export interface Callout {
  key: number;
  kind: CalloutKind;
  text: string;
  /** 말풍선을 띄울 칸 */
  cell: number;
  side: Side | null;
}

export type SoundCue =
  | { type: 'pickup'; count: number }
  | { type: 'drop'; n: number; store: boolean }
  | { type: 'capture'; count: number }
  | { type: 'extra' }
  | { type: 'sweep' };

export interface Frame {
  at: number;
  lists?: number[][];
  hand?: Hand | null;
  flyers?: Flyer[];
  callout?: Callout | null;
  sound?: SoundCue;
}

export interface Timing {
  /** 씨앗 한 알을 옮기는 시간 */
  step: number;
  /** 창고로 날아가는 시간 */
  fly: number;
  /** 단계 사이 쉬는 시간 */
  pause: number;
}

export interface Timeline {
  frames: Frame[];
  total: number;
  /** 연출이 다 끝난 뒤의 씨앗 목록 */
  final: number[][];
}

let calloutSeq = 1;
let flyerSeq = 1;

const clone = (lists: number[][]) => lists.map((l) => l.slice());

/** 씨앗이 많을 때 한 알 시간을 줄여서 한 번 뿌리기가 너무 길어지지 않게 한다. */
export function stepTime(timing: Timing, seeds: number): number {
  if (timing.step <= 0) return 0;
  return Math.max(70, Math.min(timing.step, 4200 / Math.max(1, seeds)));
}

export function buildTimeline(before: number[][], events: MancalaEvent[], timing: Timing): Timeline {
  let lists = clone(before);
  const frames: Frame[] = [];
  let t = 0;
  const push = (f: Frame) => frames.push(f);

  for (const e of events) {
    if (e.type === 'sow') {
      const D = stepTime(timing, e.path.length);
      let hand = lists[e.pit];
      lists[e.pit] = [];
      const lift = Math.max(120, D * 0.7);
      const move = D * 0.78;
      push({ at: t, lists: clone(lists), hand: { ids: hand, from: e.pit, at: e.pit, key: 0, dur: lift }, sound: { type: 'pickup', count: hand.length } });
      t += lift;
      let prev = e.pit;
      e.path.forEach((cell, s) => {
        push({ at: t, hand: { ids: hand, from: prev, at: cell, key: s + 1, dur: move } });
        t += move;
        const [seed, ...rest] = hand;
        if (seed !== undefined) lists[cell].push(seed);
        hand = rest;
        push({
          at: t,
          lists: clone(lists),
          hand: rest.length > 0 ? { ids: rest, from: prev, at: cell, key: s + 1, dur: move } : null,
          sound: { type: 'drop', n: s, store: isStore(cell) },
        });
        t += D * 0.22;
        prev = cell;
      });
      t += timing.pause;
    } else if (e.type === 'capture') {
      const store = e.side === 0 ? 6 : 13;
      const moving = [...lists[e.opposite].map((seed, slot) => ({ seed, from: e.opposite, slot })), ...lists[e.pit].map((seed, slot) => ({ seed, from: e.pit, slot }))];
      const base = lists[store].length;
      const gap = Math.min(45, timing.fly * 0.12);
      const flyers: Flyer[] = moving.map((m, k) => ({
        key: flyerSeq++,
        seed: m.seed,
        from: m.from,
        fromSlot: m.slot,
        to: store,
        toSlot: base + k,
        delay: k * gap,
        dur: timing.fly,
      }));
      lists[e.opposite] = [];
      lists[e.pit] = [];
      push({
        at: t,
        lists: clone(lists),
        flyers,
        sound: { type: 'capture', count: e.count },
        callout: { key: calloutSeq++, kind: 'capture', text: `가져오기! +${e.count}`, cell: store, side: e.side },
      });
      t += timing.fly + gap * Math.max(0, moving.length - 1);
      lists[store].push(...moving.map((m) => m.seed));
      push({ at: t, lists: clone(lists), flyers: [] });
      t += timing.pause;
    } else if (e.type === 'extra') {
      const store = e.side === 0 ? 6 : 13;
      push({ at: t, sound: { type: 'extra' }, callout: { key: calloutSeq++, kind: 'extra', text: '한 번 더!', cell: store, side: e.side } });
      t += timing.pause * 2;
    } else if (e.type === 'sweep') {
      const gap = Math.min(30, timing.fly * 0.06);
      const flyers: Flyer[] = [];
      const counts = new Map<number, number>();
      let k = 0;
      for (const m of e.moves) {
        const base = counts.get(m.to) ?? lists[m.to].length;
        lists[m.from].forEach((seed, slot) => {
          const toSlot = base + slot;
          flyers.push({ key: flyerSeq++, seed, from: m.from, fromSlot: slot, to: m.to, toSlot, delay: k * gap, dur: timing.fly });
          k += 1;
        });
        counts.set(m.to, base + lists[m.from].length);
      }
      const moved = e.moves.map((m) => ({ to: m.to, ids: lists[m.from] }));
      for (const m of e.moves) lists[m.from] = [];
      push({
        at: t,
        lists: clone(lists),
        flyers,
        sound: { type: 'sweep' },
        callout: { key: calloutSeq++, kind: 'sweep', text: '남은 씨앗 정리', cell: -1, side: null },
      });
      t += timing.fly + gap * Math.max(0, k - 1);
      for (const m of moved) lists[m.to].push(...m.ids);
      push({ at: t, lists: clone(lists), flyers: [] });
      t += timing.pause;
    }
  }
  push({ at: t, hand: null, flyers: [] });
  lists = clone(lists);
  return { frames, total: t, final: lists };
}
