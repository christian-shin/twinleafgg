/**
 * Single source of randomness for the engine (oracle patch).
 *
 * Every random outcome the rules depend on goes through one of three semantic
 * calls: `coin()`, `shuffle(n)` and `index(n)`. Outcomes are drawn from a
 * seeded generator and recorded as events, so a game can be replayed exactly
 * and another engine can consume the same outcomes as answers to its own
 * chance prompts.
 *
 * Simulation (bot look-ahead, trial dispatch, playability probes) runs inside
 * `Chance.sim(...)`: draws come from a throwaway generator, are not recorded,
 * and do not advance the real stream.
 */

export type ChanceEvent =
  | { k: 'coin'; v: boolean }
  | { k: 'shuffle'; n: number; v: number[] }
  | { k: 'index'; n: number; v: number };

/** xoshiro128** — small, fast, well distributed, easy to reproduce elsewhere. */
export class Rng {
  private s = new Uint32Array(4);

  constructor(seed: number) {
    // splitmix32 expansion of the seed
    let x = seed >>> 0;
    for (let i = 0; i < 4; i++) {
      x = (x + 0x9e3779b9) >>> 0;
      let z = x;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      this.s[i] = (z ^ (z >>> 16)) >>> 0;
    }
  }

  public nextU32(): number {
    const s = this.s;
    const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    return result;
  }

  /** Uniform integer in [0, n) by rejection sampling. */
  public below(n: number): number {
    if (n <= 1) {
      return 0;
    }
    const limit = Math.floor(0x100000000 / n) * n;
    let v = this.nextU32();
    while (v >= limit) {
      v = this.nextU32();
    }
    return v % n;
  }

  public float(): number {
    return this.nextU32() / 0x100000000;
  }
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** Source of outcomes. Default draws from the RNG; replay feeds recorded events. */
export interface ChanceSource {
  coin(): boolean;
  shuffle(n: number): number[];
  index(n: number): number;
}

export class RngSource implements ChanceSource {
  constructor(public rng: Rng) { }

  public coin(): boolean {
    return this.rng.below(2) === 0;
  }

  public shuffle(n: number): number[] {
    const order: number[] = [];
    for (let i = 0; i < n; i++) {
      order.push(i);
    }
    for (let i = n - 1; i > 0; i--) {
      const j = this.rng.below(i + 1);
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    return order;
  }

  public index(n: number): number {
    return this.rng.below(n);
  }
}

export class Chance {
  private static source: ChanceSource = new RngSource(new Rng(0));
  private static simDepth = 0;
  private static simSource: ChanceSource = new RngSource(new Rng(0x5eed));
  public static events: ChanceEvent[] = [];
  /** Number of `Math.random` calls that bypassed this module (real stream only). */
  public static strayCalls = 0;

  public static reset(seed: number, source?: ChanceSource): void {
    Chance.source = source ?? new RngSource(new Rng(seed));
    Chance.simSource = new RngSource(new Rng((seed ^ 0x5eed5eed) >>> 0));
    Chance.simDepth = 0;
    Chance.events = [];
    Chance.strayCalls = 0;
  }

  public static get inSim(): boolean {
    return Chance.simDepth > 0;
  }

  /** Run `fn` with chance draws isolated from the real, recorded stream. */
  public static sim<T>(fn: () => T): T {
    Chance.simDepth++;
    try {
      return fn();
    } finally {
      Chance.simDepth--;
    }
  }

  public static enterSim(): void {
    Chance.simDepth++;
  }

  public static exitSim(): void {
    Chance.simDepth--;
  }

  public static coin(): boolean {
    if (Chance.simDepth > 0) {
      return Chance.simSource.coin();
    }
    const v = Chance.source.coin();
    Chance.events.push({ k: 'coin', v });
    return v;
  }

  public static shuffle(n: number): number[] {
    if (Chance.simDepth > 0) {
      return Chance.simSource.shuffle(n);
    }
    const v = Chance.source.shuffle(n);
    Chance.events.push({ k: 'shuffle', n, v: v.slice() });
    return v;
  }

  public static index(n: number): number {
    if (Chance.simDepth > 0) {
      return Chance.simSource.index(n);
    }
    const v = Chance.source.index(n);
    Chance.events.push({ k: 'index', n, v });
    return v;
  }

  /** Replacement for `Math.random` so stray calls are deterministic and counted. */
  public static strayRandom(): number {
    if (Chance.simDepth > 0) {
      return (Chance.simSource as RngSource).rng?.float?.() ?? 0.5;
    }
    Chance.strayCalls++;
    const src = Chance.source as RngSource;
    return src.rng ? src.rng.float() : 0.5;
  }
}
