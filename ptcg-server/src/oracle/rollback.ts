/**
 * In-place snapshot and restore of an object graph.
 *
 * Trial dispatch must run on the real objects (card methods compare against
 * `this`, closures capture originals) and then leave no trace. A snapshot
 * records the own properties of every reachable object; restore writes them
 * back, so every original object returns to its pre-trial contents and any
 * object created during the trial becomes unreachable.
 */

import { Prompt } from '../game/store/prompts/prompt';
import { StateLog } from '../game/store/state/state-log';

type Entry =
  | { kind: 'obj'; target: any; keys: string[]; vals: any[] }
  | { kind: 'arr'; target: any[]; items: any[]; props: [string, any][] }
  | { kind: 'map'; target: Map<any, any>; entries: [any, any][] }
  | { kind: 'set'; target: Set<any>; values: any[] };

/**
 * Arrays that never change in place once a game is set up: a card's retreat,
 * weakness, resistance and evolution / archetype metadata, and the cost
 * arrays of its attacks and powers. Twinleaf reassigns some of these but
 * never edits them in place (effects copy costs; `tags` is edited in place,
 * so it is not listed). Snapshots treat them as leaves: the owning object's
 * own properties are still recorded, so a reassignment is undone. The
 * attack / power objects themselves are recorded, because cards set their
 * fields (Goldeen `attacks[0].barrage = true`, Iron Jugulis
 * `attacks[1].cost = [...]`).
 */
const IMMUTABLE = new WeakSet<object>();
const STATIC_ARRAYS = ['retreat', 'weakness', 'resistance',
  'archetype', 'evolvesTo', 'evolvesToStage', 'evolvesFromBase', 'cardTag'];

function markCardStatics(card: any): void {
  for (const key of STATIC_ARRAYS) {
    const arr = card[key];
    if (Array.isArray(arr) && !IMMUTABLE.has(arr)) {
      IMMUTABLE.add(arr);
      for (const item of arr) {
        if (item !== null && typeof item === 'object') {
          IMMUTABLE.add(item);
        }
      }
    }
  }
  for (const key of ['attacks', 'powers']) {
    const arr = card[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (item !== null && typeof item === 'object' && Array.isArray(item.cost)) {
          IMMUTABLE.add(item.cost);
        }
      }
    }
  }
}

export class Snapshot {
  private entries: Entry[] = [];

  constructor(roots: any[], private skip: (obj: any) => boolean = () => false) {
    const seen = new Set<any>();
    const stack: any[] = roots.slice();
    while (stack.length > 0) {
      const obj = stack.pop();
      if (obj === null || typeof obj !== 'object' || seen.has(obj)) {
        continue;
      }
      seen.add(obj);
      if (IMMUTABLE.has(obj) || isHistory(obj) || this.skip(obj)) {
        continue;
      }
      if (typeof obj.fullName === 'string' && typeof obj.superType === 'number') {
        markCardStatics(obj);
      }
      if (Array.isArray(obj)) {
        const items = obj.slice();
        const props: [string, any][] = [];
        for (const key of Object.keys(obj)) {
          if (!isIndex(key)) {
            props.push([key, (obj as any)[key]]);
            stack.push((obj as any)[key]);
          }
        }
        this.entries.push({ kind: 'arr', target: obj, items, props });
        for (const item of items) {
          stack.push(item);
        }
      } else if (obj instanceof Map) {
        const entries = Array.from(obj.entries());
        this.entries.push({ kind: 'map', target: obj, entries });
        for (const [k, v] of entries) {
          stack.push(k);
          stack.push(v);
        }
      } else if (obj instanceof Set) {
        const values = Array.from(obj.values());
        this.entries.push({ kind: 'set', target: obj, values });
        for (const v of values) {
          stack.push(v);
        }
      } else if (ArrayBuffer.isView(obj)) {
        continue;
      } else {
        const keys = Object.keys(obj);
        const vals = new Array(keys.length);
        for (let i = 0; i < keys.length; i++) {
          const v = obj[keys[i]];
          vals[i] = v;
          stack.push(v);
        }
        this.entries.push({ kind: 'obj', target: obj, keys, vals });
      }
    }
  }

  public restore(): void {
    for (const e of this.entries) {
      switch (e.kind) {
        case 'obj': {
          const t = e.target;
          const keys = e.keys;
          const vals = e.vals;
          // Fast path: every recorded value unchanged and no key added. Game
          // code never deletes properties, so a recorded key is still own
          // when its value matches (and a delete plus an add would need one).
          let same = true;
          for (let i = 0; i < keys.length; i++) {
            if (t[keys[i]] !== vals[i]) {
              same = false;
              break;
            }
          }
          const now = Object.keys(t);
          if (same && now.length === keys.length) {
            break;
          }
          const recorded = new Set(keys);
          for (const key of now) {
            if (!recorded.has(key)) {
              delete t[key];
            }
          }
          for (let i = 0; i < keys.length; i++) {
            if (t[keys[i]] !== vals[i] || !Object.prototype.hasOwnProperty.call(t, keys[i])) {
              t[keys[i]] = vals[i];
            }
          }
          break;
        }
        case 'arr': {
          const t = e.target as any;
          let same = t.length === e.items.length && e.props.length === 0;
          if (same) {
            for (let i = 0; i < e.items.length; i++) {
              if (t[i] !== e.items[i]) {
                same = false;
                break;
              }
            }
          }
          if (same && Object.keys(t).length === t.length) {
            break;
          }
          t.length = 0;
          for (let i = 0; i < e.items.length; i++) {
            t[i] = e.items[i];
          }
          for (const key of Object.keys(t)) {
            if (!isIndex(key)) {
              delete t[key];
            }
          }
          for (const [k, v] of e.props) {
            t[k] = v;
          }
          break;
        }
        case 'map':
          e.target.clear();
          for (const [k, v] of e.entries) {
            e.target.set(k, v);
          }
          break;
        case 'set':
          e.target.clear();
          for (const v of e.values) {
            e.target.add(v);
          }
          break;
      }
    }
  }
}

/**
 * Game history that no trial changes: log entries (never created inside a
 * simulation, never edited) and prompts already answered at snapshot time.
 * The arrays holding them are still recorded, so additions are undone; the
 * history grows all game, so walking it made every restore slower.
 */
function isHistory(obj: any): boolean {
  return obj instanceof StateLog || (obj instanceof Prompt && obj.result !== undefined);
}

function isIndex(key: string): boolean {
  return /^(0|[1-9]\d*)$/.test(key);
}

/** Run `fn` against `roots`, then put every reachable object back as it was. */
export function withRollback<T>(roots: any[], fn: () => T, skip?: (obj: any) => boolean): T {
  const snap = new Snapshot(roots, skip);
  try {
    return fn();
  } finally {
    snap.restore();
  }
}
