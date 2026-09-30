/**
 * Canonical state serialization (PLAN.md 4.2).
 *
 * Emits a JSON value with sorted keys that both engines must reproduce
 * exactly. Rules-relevant fields are discovered generically: every own field
 * of State, Player, CardList, PokemonCardList and Marker is included unless it
 * equals the value on a freshly constructed instance (defaults are omitted) or
 * is on the cosmetic denylist. Cards are written as references
 * `SET-NUMBER#id`, where `id` is the instance index assigned at deck load
 * (player 1 deck order 0..59, player 2 60..119). Mutations of per-card fields
 * (anything differing from the pristine printed card) go in `cards`.
 */
import { Card } from '../game/store/card/card';
import { CardManager } from '../game/cards/card-manager';
import { CardList } from '../game/store/state/card-list';
import { PokemonCardList } from '../game/store/state/pokemon-card-list';
import { Player } from '../game/store/state/player';
import { State } from '../game/store/state/state';
import { Marker } from '../game/store/state/card-marker';

const STATE_SKIP = new Set([
  'cardNames', 'logs', 'rules', 'prompts', 'gameSettings', 'players',
]);

const PLAYER_SKIP = new Set([
  'id', 'name', 'deckId', 'sleeveImagePath', 'deckBoxImagePath', 'coinImagePath',
  'avatarName', 'gameStats', 'playableCardIds', 'playableHandAbilityCardIds',
  'deck', 'hand', 'discard', 'lostzone', 'stadium', 'supporter', 'active', 'bench', 'prizes',
]);

const LIST_SKIP = new Set([
  'cards', 'isPublic', 'isSecret', 'markedAsNotSecret', 'stadiumDirection', 'sleeveImagePath',
]);

const POKEMON_LIST_SKIP = new Set([
  ...LIST_SKIP,
  'energies', 'tools', 'triggerEvolutionAnimation', 'showBasicAnimation',
  'triggerAttackAnimation', 'showAllStageAbilities', '__uniqueId',
]);

/** Card fields that never carry rules state. */
const CARD_SKIP = new Set(['id', 'cardImage', 'text', 'fullName']);

export function cardRef(card: Card): string {
  return `${card.set}-${card.setNumber}#${card.id}`;
}

/** Serialize an arbitrary value with cards as refs and functions dropped. */
function plain(value: any, seen: Set<any>): any {
  if (value === null || value === undefined) {
    return null;
  }
  const t = typeof value;
  if (t === 'function') {
    return undefined;
  }
  if (t === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (t !== 'object') {
    return value;
  }
  if (value instanceof Card) {
    return cardRef(value);
  }
  if (value instanceof CardList && !(value instanceof PokemonCardList)) {
    return value.cards.map(c => cardRef(c));
  }
  if (seen.has(value)) {
    return '<cycle>';
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map(v => {
        const p = plain(v, seen);
        return p === undefined ? null : p;
      });
    }
    if (value instanceof Map) {
      return Array.from(value.entries()).map(([k, v]) => [plain(k, seen), plain(v, seen)]);
    }
    if (value instanceof Set) {
      return Array.from(value.values()).map(v => plain(v, seen));
    }
    const out: any = {};
    for (const key of Object.keys(value)) {
      const p = plain(value[key], seen);
      if (p !== undefined) {
        out[key] = p;
      }
    }
    return out;
  } finally {
    seen.delete(value);
  }
}

const defaultsCache = new Map<Function, any>();

function defaultsOf(ctor: new () => any): any {
  let d = defaultsCache.get(ctor);
  if (d === undefined) {
    const inst = new ctor();
    d = {};
    for (const key of Object.keys(inst)) {
      d[key] = stableStringify(plain(inst[key], new Set()));
    }
    defaultsCache.set(ctor, d);
  }
  return d;
}

/** Own fields of `obj` that differ from a fresh `ctor` instance. */
function nonDefaultFields(obj: any, ctor: new () => any, skip: Set<string>): any {
  const d = defaultsOf(ctor);
  const out: any = {};
  for (const key of Object.keys(obj)) {
    if (skip.has(key)) {
      continue;
    }
    const p = plain(obj[key], new Set());
    if (p === undefined) {
      continue;
    }
    if (d[key] !== undefined && d[key] === stableStringify(p)) {
      continue;
    }
    if (d[key] === undefined && (p === null || p === false || p === 0)) {
      // Field absent on fresh instances; treat falsy as default.
      continue;
    }
    out[key] = p;
  }
  return out;
}

function markers(marker: Marker): any[] {
  return marker.markers
    .map(m => {
      const out: any = { name: m.name };
      if (m.source !== undefined) {
        out.source = cardRef(m.source);
      }
      if (m.sourceType !== undefined) {
        out.sourceType = m.sourceType;
      }
      if (m.targetScope !== undefined) {
        out.targetScope = m.targetScope;
      }
      return out;
    })
    .sort((a, b) => cmp(stableStringify(a), stableStringify(b)));
}

function sortedRefs(list: CardList): string[] {
  return list.cards.map(c => cardRef(c)).sort(cmp);
}

function slot(list: PokemonCardList): any {
  const fields = nonDefaultFields(list, PokemonCardList, POKEMON_LIST_SKIP);
  delete fields.marker;
  const out: any = {
    cards: list.cards.map(c => cardRef(c)),
    ...fields,
  };
  const energy = list.energies.cards.map(c => cardRef(c));
  if (energy.length > 0) {
    out.energies = energy;
  }
  if (list.tools.length > 0) {
    out.tools = list.tools.map(c => cardRef(c));
  }
  const m = markers(list.marker);
  if (m.length > 0) {
    out.markers = m;
  }
  if (list.specialConditions.length > 0) {
    out.specialConditions = list.specialConditions.slice().sort((a, b) => a - b);
  }
  return out;
}

function player(p: Player): any {
  const fields = nonDefaultFields(p, Player, PLAYER_SKIP);
  delete fields.marker;
  const out: any = {
    deck: p.deck.cards.map(c => cardRef(c)),
    hand: sortedRefs(p.hand),
    discard: sortedRefs(p.discard),
    lostzone: sortedRefs(p.lostzone),
    stadium: p.stadium.cards.map(c => cardRef(c)),
    supporter: p.supporter.cards.map(c => cardRef(c)),
    prizes: p.prizes.map(l => l.cards.map(c => cardRef(c))),
    active: slot(p.active),
    bench: p.bench.map(b => slot(b)),
    ...fields,
  };
  const faceUp = p.prizes.map(l => l.faceUpPrize === true);
  if (faceUp.some(v => v)) {
    out.faceUpPrizes = faceUp;
  }
  const m = markers(p.marker);
  if (m.length > 0) {
    out.markers = m;
  }
  return out;
}

const pristineCache = new Map<string, any>();

function pristine(card: Card): any {
  let p = pristineCache.get(card.fullName);
  if (p === undefined) {
    const fresh = CardManager.getInstance().getCardByName(card.fullName);
    p = {};
    if (fresh !== undefined) {
      for (const key of Object.keys(fresh)) {
        if (!CARD_SKIP.has(key)) {
          const v = plain((fresh as any)[key], new Set());
          if (v !== undefined) {
            p[key] = stableStringify(v);
          }
        }
      }
    }
    pristineCache.set(card.fullName, p);
  }
  return p;
}

/** Per-card fields that differ from the printed card. */
function cardMutations(state: State): any {
  const all: Card[] = [];
  const visit = (list: CardList) => list.cards.forEach(c => all.push(c));
  for (const p of state.players) {
    [p.deck, p.hand, p.discard, p.lostzone, p.stadium, p.supporter, p.active, ...p.bench, ...p.prizes]
      .forEach(visit);
    p.active.tools.forEach(c => all.push(c));
    p.bench.forEach(b => b.tools.forEach(c => all.push(c)));
  }
  const out: any = {};
  const seenCards = new Set<Card>();
  for (const card of all) {
    if (seenCards.has(card)) {
      continue;
    }
    seenCards.add(card);
    const base = pristine(card);
    const diff: any = {};
    for (const key of Object.keys(card)) {
      if (CARD_SKIP.has(key)) {
        continue;
      }
      const v = plain((card as any)[key], new Set());
      if (v === undefined) {
        continue;
      }
      const s = stableStringify(v);
      if (base[key] !== s) {
        if (base[key] === undefined && (v === null || v === false || v === 0)) {
          continue;
        }
        diff[key] = v;
      }
    }
    if (Object.keys(diff).length > 0) {
      out[cardRef(card)] = diff;
    }
  }
  return out;
}

export function canonicalState(state: State): any {
  const st: any = {};
  for (const key of Object.keys(state)) {
    if (STATE_SKIP.has(key)) {
      continue;
    }
    const v = plain((state as any)[key], new Set());
    if (v === undefined || v === null || v === false) {
      continue;
    }
    if (key === 'lastAttack' && v && typeof v === 'object') {
      st.lastAttack = (state as any).lastAttack.name;
      continue;
    }
    if (key === 'playerLastAttack') {
      const pla: any = {};
      for (const pid of Object.keys((state as any).playerLastAttack)) {
        const e = (state as any).playerLastAttack[pid];
        pla[pid] = { attack: e.attack.name, sourceCard: cardRef(e.sourceCard) };
      }
      if (Object.keys(pla).length > 0) {
        st.playerLastAttack = pla;
      }
      continue;
    }
    st[key] = v;
  }
  st.players = state.players.map(p => player(p));
  const cards = cardMutations(state);
  if (Object.keys(cards).length > 0) {
    st.cards = cards;
  }
  return st;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** JSON with object keys sorted; the canonical text both engines hash. */
export function stableStringify(v: any): string {
  if (v === null || v === undefined) {
    return 'null';
  }
  if (Array.isArray(v)) {
    return '[' + v.map(x => stableStringify(x)).join(',') + ']';
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v).sort(cmp);
    return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

/** 64-bit FNV-1a over the UTF-8 bytes, as 16 hex digits. */
export function fnv1a64(text: string): string {
  // 64-bit arithmetic on two 32-bit halves; prime = 0x100_000001b3.
  let hi = 0xcbf29ce4;
  let lo = 0x84222325;
  const bytes = Buffer.from(text, 'utf8');
  for (let i = 0; i < bytes.length; i++) {
    lo = (lo ^ bytes[i]) >>> 0;
    const loMul = lo * 0x1b3;
    const carry = Math.floor(loMul / 4294967296);
    hi = (Math.imul(hi, 0x1b3) + Math.imul(lo, 0x100) + carry) >>> 0;
    lo = loMul >>> 0;
  }
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0');
}

export function stateHash(state: State): string {
  return fnv1a64(stableStringify(canonicalState(state)));
}
