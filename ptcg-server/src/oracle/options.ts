/**
 * Decision descriptors, legal answers and random answers for every prompt
 * type, plus turn-level option enumeration (PLAN.md 4.1 step 5).
 *
 * A descriptor is the canonical, engine-independent description of a decision
 * (the cabt-shaped select). Answers are recorded in Twinleaf's raw wire format
 * (the shape `prompt.decode` accepts), so a trace can be replayed through the
 * same decode + validate path the socket server uses.
 */
import { Card } from '../game/store/card/card';
import { EnergyCard } from '../game/store/card/energy-card';
import { PokemonCard } from '../game/store/card/pokemon-card';
import { TrainerCard } from '../game/store/card/trainer-card';
import { SuperType, Stage, TrainerType } from '../game/store/card/card-types';
import { State } from '../game/store/state/state';
import { Player } from '../game/store/state/player';
import { PokemonCardList } from '../game/store/state/pokemon-card-list';
import { StateUtils } from '../game/store/state-utils';
import { CardTarget, PlayerType, SlotType, PlayCardAction } from '../game/store/actions/play-card-action';
import {
  AttackAction, PassTurnAction, RetreatAction, UseAbilityAction, UseStadiumAction,
  UseTrainerAbilityAction, UseEnergyAbilityAction,
} from '../game/store/actions/game-actions';
import { Action } from '../game/store/actions/action';
import { Prompt } from '../game/store/prompts/prompt';
import { AlertPrompt } from '../game/store/prompts/alert-prompt';
import { AttachEnergyPrompt } from '../game/store/prompts/attach-energy-prompt';
import { ChooseAttackPrompt } from '../game/store/prompts/choose-attack-prompt';
import { ChooseCardsPrompt, matchesPromptFilter } from '../game/store/prompts/choose-cards-prompt';
import { ChooseEnergyPrompt } from '../game/store/prompts/choose-energy-prompt';
import { ChoosePokemonPrompt } from '../game/store/prompts/choose-pokemon-prompt';
import { ChoosePrizePrompt } from '../game/store/prompts/choose-prize-prompt';
import { CoinFlipPrompt } from '../game/store/prompts/coin-flip-prompt';
import { ConfirmCardsPrompt } from '../game/store/prompts/confirm-cards-prompt';
import { ConfirmPrompt } from '../game/store/prompts/confirm-prompt';
import { DiscardEnergyPrompt } from '../game/store/prompts/discard-energy-prompt';
import { MoveDamagePrompt } from '../game/store/prompts/move-damage-prompt';
import { MoveEnergyPrompt } from '../game/store/prompts/move-energy-prompt';
import { OrderCardsPrompt } from '../game/store/prompts/order-cards-prompt';
import { PutDamagePrompt } from '../game/store/prompts/put-damage-prompt';
import { RemoveDamagePrompt } from '../game/store/prompts/remove-damage-prompt';
import { SelectOptionPrompt } from '../game/store/prompts/select-option-prompt';
import { SelectPrompt } from '../game/store/prompts/select-prompt';
import { ShowCardsPrompt } from '../game/store/prompts/show-cards-prompt';
import { ShowMulliganPrompt } from '../game/store/prompts/show-mulligan-prompt';
import { ShuffleDeckPrompt } from '../game/store/prompts/shuffle-prompt';
import { ShuffleHandPrompt } from '../game/store/prompts/shuffle-hand-prompt';
import { ShufflePrizesPrompt } from '../game/store/prompts/shuffle-prizes-prompt';
import { WaitPrompt } from '../game/store/prompts/wait-prompt';
import { CheckPokemonAttacksEffect, CheckPokemonPowersEffect } from '../game/store/effects/check-effects';
import { Rng } from '../game/core/chance';
import { cardRef } from './canonical';

// ---------------------------------------------------------------------------
// Classification

export type PromptClass = 'chance' | 'info' | 'decision';

export function classifyPrompt(prompt: Prompt<any>): PromptClass {
  if (prompt instanceof ShuffleDeckPrompt || prompt instanceof CoinFlipPrompt
    || prompt instanceof ShufflePrizesPrompt || prompt instanceof ShuffleHandPrompt) {
    return 'chance';
  }
  if (prompt instanceof AlertPrompt || prompt instanceof ShowCardsPrompt
    || prompt instanceof ShowMulliganPrompt || prompt instanceof ConfirmCardsPrompt
    || prompt instanceof WaitPrompt) {
    return 'info';
  }
  return 'decision';
}

export function playerIndex(state: State, playerId: number): number {
  return state.players.findIndex(p => p.id === playerId);
}

function perspective(state: State, prompt: Prompt<any>): Player {
  const p = state.players.find(pl => pl.id === prompt.getPerspectivePlayerId());
  if (p === undefined) {
    throw new Error('prompt perspective player missing');
  }
  return p;
}

/** In-play targets for a (playerType, slots) pair, relative to `player`. */
export function slotTargets(state: State, player: Player, playerType: PlayerType, slots: SlotType[]): CardTarget[] {
  const out: CardTarget[] = [];
  const sides: PlayerType[] = playerType === PlayerType.ANY
    ? [PlayerType.BOTTOM_PLAYER, PlayerType.TOP_PLAYER]
    : [playerType];
  for (const side of sides) {
    const owner = side === PlayerType.BOTTOM_PLAYER ? player : StateUtils.getOpponent(state, player);
    if (slots.includes(SlotType.ACTIVE) && owner.active.cards.length > 0) {
      out.push({ player: side, slot: SlotType.ACTIVE, index: 0 });
    }
    if (slots.includes(SlotType.BENCH)) {
      owner.bench.forEach((b, index) => {
        if (b.cards.length > 0) {
          out.push({ player: side, slot: SlotType.BENCH, index });
        }
      });
    }
  }
  return out;
}

function sameTarget(a: CardTarget, b: CardTarget): boolean {
  return a.player === b.player && a.slot === b.slot && a.index === b.index;
}

function targetIn(list: CardTarget[], t: CardTarget): boolean {
  return list.some(b => sameTarget(b, t));
}

function listFor(state: State, player: Player, t: CardTarget): PokemonCardList {
  return StateUtils.getTarget(state, player, t);
}

function tgt(t: CardTarget): any {
  return { player: t.player, slot: t.slot, index: t.index };
}

function blockedTargetsResolved(state: State, player: Player, blocked: CardTarget[]): PokemonCardList[] {
  const out: PokemonCardList[] = [];
  for (const b of blocked) {
    try {
      out.push(StateUtils.getTarget(state, player, b));
    } catch {
      // invalid blocked targets are ignored, like the prompt's own validate
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Descriptors

function refs(cards: Card[]): string[] {
  return cards.map(c => cardRef(c));
}

function plainOptions(options: any): any {
  const out: any = {};
  for (const key of Object.keys(options ?? {})) {
    const v = options[key];
    if (v === undefined || typeof v === 'function') {
      continue;
    }
    if (v instanceof Card) {
      out[key] = cardRef(v);
    } else if (v && typeof v === 'object' && Array.isArray(v.cards)) {
      out[key] = refs(v.cards);
    } else {
      out[key] = v;
    }
  }
  return out;
}

function plainFilter(filter: any): any {
  const out: any = {};
  for (const key of Object.keys(filter ?? {})) {
    const v = filter[key];
    if (v !== undefined && typeof v !== 'function') {
      out[key] = v;
    }
  }
  return out;
}

/** Canonical description of a decision prompt, compared across engines. */
export function describePrompt(state: State, prompt: Prompt<any>): any {
  const base: any = {
    kind: 'prompt',
    type: prompt.type,
    cls: prompt.constructor.name,
    player: playerIndex(state, prompt.playerId),
  };
  if (prompt.perspectivePlayerId !== undefined) {
    base.perspective = playerIndex(state, prompt.perspectivePlayerId);
  }
  const msg = (prompt as any).message;
  if (msg !== undefined) {
    base.message = msg;
  }
  const player = perspective(state, prompt);

  if (prompt instanceof ChooseCardsPrompt) {
    const cards = prompt.cards.cards;
    return {
      ...base,
      cards: refs(cards),
      selectable: cards.map((c, i) => !prompt.options.blocked.includes(i) && matchesPromptFilter(c, prompt.filter)),
      filter: plainFilter(prompt.filter),
      options: plainOptions(prompt.options),
    };
  }
  if (prompt instanceof ChoosePokemonPrompt) {
    const blocked = blockedTargetsResolved(state, player, prompt.options.blocked);
    const candidates = slotTargets(state, player, prompt.playerType, prompt.slots)
      .filter(t => !blocked.includes(listFor(state, player, t)));
    return {
      ...base,
      playerType: prompt.playerType,
      slots: prompt.slots,
      options: plainOptions(prompt.options),
      candidates: candidates.map(tgt),
    };
  }
  if (prompt instanceof AttachEnergyPrompt) {
    const cards = prompt.cardList.cards;
    const targets = slotTargets(state, player, prompt.playerType, prompt.slots)
      .filter(t => !targetIn(prompt.options.blockedTo, t));
    return {
      ...base,
      cards: refs(cards),
      selectable: cards.map((c, i) => c.superType === SuperType.ENERGY
        && !prompt.options.blocked.includes(i) && matchesPromptFilter(c, prompt.filter)),
      playerType: prompt.playerType,
      slots: prompt.slots,
      filter: plainFilter(prompt.filter),
      options: plainOptions(prompt.options),
      targets: targets.map(tgt),
    };
  }
  if (prompt instanceof ChooseEnergyPrompt) {
    return {
      ...base,
      energy: prompt.energy.map(e => ({ card: cardRef(e.card), provides: e.provides })),
      cost: prompt.cost,
      options: plainOptions(prompt.options),
    };
  }
  if (prompt instanceof ChooseAttackPrompt) {
    return {
      ...base,
      cards: refs(prompt.cards),
      attacks: prompt.cards.map(c => c.attacks.map(a => a.name)),
      options: plainOptions(prompt.options),
    };
  }
  if (prompt instanceof ChoosePrizePrompt) {
    const target = prompt.options.useOpponentPrizes ? StateUtils.getOpponent(state, player) : player;
    return {
      ...base,
      prizes: target.prizes.filter(p => p.cards.length > 0).length,
      options: plainOptions({ ...prompt.options, destination: undefined }),
    };
  }
  if (prompt instanceof ConfirmPrompt) {
    return base;
  }
  if (prompt instanceof SelectPrompt || prompt instanceof SelectOptionPrompt) {
    return { ...base, values: prompt.values, options: plainOptions(prompt.options) };
  }
  if (prompt instanceof OrderCardsPrompt) {
    return { ...base, cards: refs(prompt.cards.cards), options: plainOptions(prompt.options) };
  }
  if (prompt instanceof PutDamagePrompt) {
    return {
      ...base,
      playerType: prompt.playerType,
      slots: prompt.slots,
      damage: prompt.damage,
      maxAllowedDamage: prompt.maxAllowedDamage.map(m => ({ target: tgt(m.target), damage: m.damage })),
      options: plainOptions(prompt.options),
    };
  }
  if (prompt instanceof MoveDamagePrompt || prompt instanceof RemoveDamagePrompt) {
    return {
      ...base,
      playerType: prompt.playerType,
      slots: prompt.slots,
      maxAllowedDamage: prompt.maxAllowedDamage.map(m => ({ target: tgt(m.target), damage: m.damage })),
      options: plainOptions(prompt.options),
    };
  }
  if (prompt instanceof MoveEnergyPrompt || prompt instanceof DiscardEnergyPrompt) {
    return {
      ...base,
      playerType: prompt.playerType,
      slots: prompt.slots,
      filter: plainFilter(prompt.filter),
      options: plainOptions(prompt.options),
      sources: energySources(state, player, prompt).map(s => ({ from: tgt(s.from), indices: s.indices })),
    };
  }
  return { ...base, unknown: true };
}

function energySources(state: State, player: Player, prompt: MoveEnergyPrompt | DiscardEnergyPrompt): { from: CardTarget, indices: number[] }[] {
  const out: { from: CardTarget, indices: number[] }[] = [];
  for (const from of slotTargets(state, player, prompt.playerType, prompt.slots)) {
    if (targetIn(prompt.options.blockedFrom, from)) {
      continue;
    }
    const list = listFor(state, player, from);
    const blockedEntry = prompt.options.blockedMap.find(m => sameTarget(m.source, from));
    const blocked = blockedEntry ? blockedEntry.blocked : [];
    const indices: number[] = [];
    list.cards.forEach((c, i) => {
      if (c.superType === SuperType.ENERGY && !blocked.includes(i) && matchesPromptFilter(c, prompt.filter)) {
        indices.push(i);
      }
    });
    if (indices.length > 0) {
      out.push({ from, indices });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Random answers (raw wire format). Return `undefined` when no answer exists.

function pickSubset<T>(rng: Rng, items: T[], k: number): T[] {
  const pool = items.slice();
  const out: T[] = [];
  for (let i = 0; i < k && pool.length > 0; i++) {
    out.push(pool.splice(rng.below(pool.length), 1)[0]);
  }
  return out;
}

function between(rng: Rng, lo: number, hi: number): number {
  if (hi < lo) {
    return lo;
  }
  return lo + rng.below(hi - lo + 1);
}

/** Decode + validate a raw answer; returns the decoded value or throws. */
export function decodeAnswer(state: State, prompt: Prompt<any>, raw: any): any {
  const decoded = prompt.decode(raw, state);
  if (prompt.validate(decoded, state) === false) {
    throw new Error('INVALID_ANSWER');
  }
  return decoded;
}

function isValid(state: State, prompt: Prompt<any>, raw: any): boolean {
  try {
    decodeAnswer(state, prompt, raw);
    return true;
  } catch {
    return false;
  }
}

const TRIES = 40;

export function randomAnswer(state: State, prompt: Prompt<any>, rng: Rng, cancelRate = 0.05): any {
  const opts: any = (prompt as any).options ?? {};
  if (opts.allowCancel === true && rng.float() < cancelRate) {
    return null;
  }
  const raw = randomAnswerInner(state, prompt, rng);
  if (raw !== undefined) {
    return raw;
  }
  if (opts.allowCancel === true) {
    return null;
  }
  return undefined;
}

function randomAnswerInner(state: State, prompt: Prompt<any>, rng: Rng): any {
  const player = perspective(state, prompt);

  if (prompt instanceof ChooseCardsPrompt) {
    const cards = prompt.cards.cards;
    const selectable: number[] = [];
    cards.forEach((c, i) => {
      if (!prompt.options.blocked.includes(i) && matchesPromptFilter(c, prompt.filter)) {
        selectable.push(i);
      }
    });
    const min = prompt.options.min;
    const max = Math.min(prompt.options.max, selectable.length);
    for (let t = 0; t < TRIES; t++) {
      const k = between(rng, min, max);
      const raw = pickSubset(rng, selectable, k).sort((a, b) => a - b);
      if (isValid(state, prompt, raw)) {
        return raw;
      }
    }
    // Greedy fallback: grow from empty in index order.
    const raw: number[] = [];
    for (const i of selectable) {
      if (raw.length >= min && isValid(state, prompt, raw)) {
        return raw;
      }
      raw.push(i);
      if (raw.length > prompt.options.max) {
        break;
      }
    }
    return isValid(state, prompt, raw) ? raw : undefined;
  }

  if (prompt instanceof ChoosePokemonPrompt) {
    const blocked = blockedTargetsResolved(state, player, prompt.options.blocked);
    const candidates = slotTargets(state, player, prompt.playerType, prompt.slots)
      .filter(t => !blocked.includes(listFor(state, player, t)));
    const min = prompt.options.min;
    const max = Math.min(prompt.options.max, candidates.length);
    for (let t = 0; t < TRIES; t++) {
      const raw = pickSubset(rng, candidates, between(rng, min, max)).map(tgt);
      if (isValid(state, prompt, raw)) {
        return raw;
      }
    }
    return undefined;
  }

  if (prompt instanceof AttachEnergyPrompt) {
    const cards = prompt.cardList.cards;
    const energies: number[] = [];
    cards.forEach((c, i) => {
      if (c.superType === SuperType.ENERGY && !prompt.options.blocked.includes(i) && matchesPromptFilter(c, prompt.filter)) {
        energies.push(i);
      }
    });
    const targets = slotTargets(state, player, prompt.playerType, prompt.slots)
      .filter(t => !targetIn(prompt.options.blockedTo, t));
    if (targets.length === 0) {
      return prompt.options.min === 0 ? [] : undefined;
    }
    const min = prompt.options.min;
    const max = Math.min(prompt.options.max, energies.length);
    for (let t = 0; t < TRIES; t++) {
      const chosen = pickSubset(rng, energies, between(rng, min, max));
      const fixed = targets[rng.below(targets.length)];
      const raw = chosen.map(index => ({
        to: tgt(prompt.options.sameTarget ? fixed : targets[rng.below(targets.length)]),
        index,
      }));
      if (isValid(state, prompt, raw)) {
        return raw;
      }
    }
    return undefined;
  }

  if (prompt instanceof ChooseEnergyPrompt) {
    const n = prompt.energy.length;
    const valid: number[][] = [];
    if (n <= 14) {
      for (let mask = 0; mask < (1 << n); mask++) {
        const raw: number[] = [];
        for (let i = 0; i < n; i++) {
          if (mask & (1 << i)) {
            raw.push(i);
          }
        }
        if (isValid(state, prompt, raw)) {
          valid.push(raw);
        }
      }
    } else {
      for (let t = 0; t < TRIES * 5; t++) {
        const all = Array.from({ length: n }, (_, i) => i);
        const raw = pickSubset(rng, all, between(rng, 0, n)).sort((a, b) => a - b);
        if (isValid(state, prompt, raw)) {
          valid.push(raw);
          break;
        }
      }
    }
    return valid.length > 0 ? valid[rng.below(valid.length)] : undefined;
  }

  if (prompt instanceof ChooseAttackPrompt) {
    const all: { index: number, attack: string }[] = [];
    prompt.cards.forEach((c, index) => c.attacks.forEach(a => all.push({ index, attack: a.name })));
    const valid = all.filter(r => isValid(state, prompt, r));
    return valid.length > 0 ? valid[rng.below(valid.length)] : undefined;
  }

  if (prompt instanceof ChoosePrizePrompt) {
    const target = prompt.options.useOpponentPrizes ? StateUtils.getOpponent(state, player) : player;
    const left = target.prizes.filter(p => p.cards.length > 0).length;
    const required = Math.min(prompt.options.count, left);
    const idx = Array.from({ length: left }, (_, i) => i);
    for (let t = 0; t < TRIES; t++) {
      const raw = pickSubset(rng, idx, required);
      if (isValid(state, prompt, raw)) {
        return raw;
      }
    }
    return undefined;
  }

  if (prompt instanceof ConfirmPrompt) {
    return rng.below(2) === 0;
  }

  if (prompt instanceof SelectOptionPrompt) {
    const disabled = prompt.options.disabled ?? [];
    const idx = prompt.values.map((_, i) => i).filter(i => !disabled[i]);
    return idx.length > 0 ? idx[rng.below(idx.length)] : undefined;
  }

  if (prompt instanceof SelectPrompt) {
    return prompt.values.length > 0 ? rng.below(prompt.values.length) : undefined;
  }

  if (prompt instanceof OrderCardsPrompt) {
    const n = prompt.cards.cards.length;
    return pickSubset(rng, Array.from({ length: n }, (_, i) => i), n);
  }

  if (prompt instanceof PutDamagePrompt) {
    const blocked = blockedTargetsResolved(state, player, prompt.options.blocked);
    const targets = slotTargets(state, player, prompt.playerType, prompt.slots)
      .filter(t => !blocked.includes(listFor(state, player, t)));
    const unit = prompt.options.damageMultiple ?? 10;
    for (let t = 0; t < TRIES; t++) {
      const placed = new Map<string, { target: CardTarget, damage: number }>();
      let left = prompt.damage;
      if (prompt.options.allowPlacePartialDamage) {
        left = unit * between(rng, 0, Math.floor(prompt.damage / unit));
      }
      let guard = 0;
      while (left > 0 && targets.length > 0 && guard++ < 1000) {
        const target = targets[rng.below(targets.length)];
        const key = `${target.player}-${target.slot}-${target.index}`;
        const cap = prompt.maxAllowedDamage.find(m => sameTarget(m.target, target));
        const cur = placed.get(key)?.damage ?? 0;
        if (cap !== undefined && cur + unit > cap.damage) {
          continue;
        }
        placed.set(key, { target, damage: cur + unit });
        left -= unit;
      }
      const raw = Array.from(placed.values()).map(p => ({ target: tgt(p.target), damage: p.damage }));
      if (isValid(state, prompt, raw)) {
        return raw;
      }
    }
    return undefined;
  }

  if (prompt instanceof MoveDamagePrompt || prompt instanceof RemoveDamagePrompt) {
    const blockedFrom = prompt.options.blockedFrom;
    const blockedTo = prompt.options.blockedTo;
    const all = slotTargets(state, player, prompt.playerType, prompt.slots);
    const froms = all.filter(t => !targetIn(blockedFrom, t));
    const tos = all.filter(t => !targetIn(blockedTo, t));
    const max = prompt.options.max ?? 6;
    for (let t = 0; t < TRIES; t++) {
      const damage = new Map<string, number>();
      all.forEach(x => damage.set(JSON.stringify(tgt(x)), listFor(state, player, x).damage));
      const k = between(rng, prompt.options.min, max);
      const raw: any[] = [];
      for (let j = 0; j < k; j++) {
        const withDamage = froms.filter(f => (damage.get(JSON.stringify(tgt(f))) ?? 0) >= 10);
        if (withDamage.length === 0) {
          break;
        }
        const from = withDamage[rng.below(withDamage.length)];
        const toChoices = tos.filter(x => !sameTarget(x, from));
        if (toChoices.length === 0) {
          break;
        }
        const to = toChoices[rng.below(toChoices.length)];
        const fk = JSON.stringify(tgt(from));
        damage.set(fk, (damage.get(fk) ?? 0) - 10);
        raw.push({ from: tgt(from), to: tgt(to) });
      }
      if (isValid(state, prompt, raw)) {
        return raw;
      }
    }
    return undefined;
  }

  if (prompt instanceof DiscardEnergyPrompt || prompt instanceof MoveEnergyPrompt) {
    const sources = energySources(state, player, prompt);
    const flat: { from: CardTarget, index: number }[] = [];
    sources.forEach(s => s.indices.forEach(index => flat.push({ from: s.from, index })));
    const max = Math.min(prompt.options.max ?? flat.length, flat.length);
    const all = slotTargets(state, player, prompt.playerType, prompt.slots);
    for (let t = 0; t < TRIES; t++) {
      const chosen = pickSubset(rng, flat, between(rng, prompt.options.min, max));
      let raw: any[];
      if (prompt instanceof MoveEnergyPrompt) {
        raw = [];
        let ok = true;
        for (const c of chosen) {
          const tos = all.filter(x => !sameTarget(x, c.from) && !targetIn(prompt.options.blockedTo, x));
          if (tos.length === 0) {
            ok = false;
            break;
          }
          raw.push({ from: tgt(c.from), to: tgt(tos[rng.below(tos.length)]), index: c.index });
        }
        if (!ok) {
          continue;
        }
      } else {
        raw = chosen.map(c => ({ from: tgt(c.from), index: c.index }));
      }
      if (isValid(state, prompt, raw)) {
        return raw;
      }
    }
    return undefined;
  }

  return undefined;
}

/** Answers for info prompts (no choice). */
export function infoAnswer(prompt: Prompt<any>): any {
  return true;
}

// ---------------------------------------------------------------------------
// Encoding decoded answers (from the simple bot) back to raw.

function targetOf(state: State, player: Player, list: PokemonCardList): CardTarget | undefined {
  const opp = StateUtils.getOpponent(state, player);
  if (list === player.active) {
    return { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.ACTIVE, index: 0 };
  }
  let i = player.bench.indexOf(list);
  if (i !== -1) {
    return { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.BENCH, index: i };
  }
  if (list === opp.active) {
    return { player: PlayerType.TOP_PLAYER, slot: SlotType.ACTIVE, index: 0 };
  }
  i = opp.bench.indexOf(list);
  if (i !== -1) {
    return { player: PlayerType.TOP_PLAYER, slot: SlotType.BENCH, index: i };
  }
  return undefined;
}

export function encodeAnswer(state: State, prompt: Prompt<any>, decoded: any): any {
  if (decoded === null || decoded === undefined) {
    return null;
  }
  const player = perspective(state, prompt);
  if (prompt instanceof ChooseCardsPrompt) {
    return (decoded as Card[]).map(c => prompt.cards.cards.indexOf(c));
  }
  if (prompt instanceof ChoosePokemonPrompt) {
    return (decoded as PokemonCardList[]).map(l => {
      const t = targetOf(state, player, l);
      return t ? tgt(t) : null;
    });
  }
  if (prompt instanceof AttachEnergyPrompt) {
    return (decoded as any[]).map(a => ({ to: tgt(a.to), index: prompt.cardList.cards.indexOf(a.card) }));
  }
  if (prompt instanceof ChooseEnergyPrompt) {
    return (decoded as any[]).map(e => prompt.energy.indexOf(e));
  }
  if (prompt instanceof ChooseAttackPrompt) {
    const index = prompt.cards.findIndex(c => c.attacks.includes(decoded));
    return { index, attack: decoded.name };
  }
  if (prompt instanceof ChoosePrizePrompt) {
    const target = prompt.options.useOpponentPrizes ? StateUtils.getOpponent(state, player) : player;
    const nonEmpty = target.prizes.filter(p => p.cards.length > 0);
    return (decoded as any[]).map(l => nonEmpty.indexOf(l));
  }
  if (prompt instanceof DiscardEnergyPrompt) {
    return (decoded as any[]).map(t => ({
      from: tgt(t.from), index: listFor(state, player, t.from).cards.indexOf(t.card),
    }));
  }
  if (prompt instanceof MoveEnergyPrompt) {
    return (decoded as any[]).map(t => ({
      from: tgt(t.from), to: tgt(t.to), index: listFor(state, player, t.from).cards.indexOf(t.card),
    }));
  }
  if (prompt instanceof PutDamagePrompt) {
    return (decoded as any[]).map(m => ({ target: tgt(m.target), damage: m.damage }));
  }
  if (prompt instanceof MoveDamagePrompt || prompt instanceof RemoveDamagePrompt) {
    return (decoded as any[]).map(m => ({ from: tgt(m.from), to: tgt(m.to) }));
  }
  return decoded;
}

// ---------------------------------------------------------------------------
// Turn-level options

export interface TurnOption {
  /** Canonical description, compared across engines. */
  desc: any;
  action: Action;
}

const BOARD_TARGET: CardTarget = { player: PlayerType.BOTTOM_PLAYER, slot: SlotType.BOARD, index: 0 };

/**
 * Structural candidates for the active player's turn. Legality is decided
 * afterwards by trial dispatch; this list only needs to be a superset.
 */
export function turnCandidates(store: any, state: State, player: Player): TurnOption[] {
  const out: TurnOption[] = [];
  const own = slotTargets(state, player, PlayerType.BOTTOM_PLAYER, [SlotType.ACTIVE, SlotType.BENCH]);
  const firstEmptyBench = player.bench.findIndex(b => b.cards.length === 0);

  player.hand.cards.forEach((card, handIndex) => {
    const ref = cardRef(card);
    const play = (target: CardTarget) => out.push({
      desc: { a: 'play', card: ref, target: tgt(target) },
      action: new PlayCardAction(player.id, handIndex, target),
    });
    if (card instanceof EnergyCard) {
      own.forEach(play);
    } else if (card instanceof PokemonCard) {
      if (firstEmptyBench !== -1) {
        play({ player: PlayerType.BOTTOM_PLAYER, slot: SlotType.BENCH, index: firstEmptyBench });
      }
      if (card.stage !== Stage.BASIC) {
        own.forEach(play);
      }
    } else if (card instanceof TrainerCard) {
      if (card.trainerType === TrainerType.TOOL) {
        own.forEach(play);
      } else {
        play(BOARD_TARGET);
      }
    }
  });

  // Attacks: active Pokémon's attacks, attacks granted by effects, bench attacks.
  const names = new Set<string>();
  const active = player.active.getPokemonCard();
  if (active) {
    active.attacks.forEach(a => names.add(a.name));
  }
  player.bench.forEach(b => {
    const p = b.getPokemonCard();
    if (p) {
      p.attacks.filter(a => a.useOnBench).forEach(a => names.add(a.name));
    }
  });
  try {
    const check = new CheckPokemonAttacksEffect(player);
    store.reduceEffect(state, check);
    check.attacks.forEach((a: any) => names.add(a.name));
  } catch {
    // ignored; trial dispatch decides
  }
  for (const name of Array.from(names).sort()) {
    out.push({ desc: { a: 'attack', name }, action: new AttackAction(player.id, name) });
  }

  // Pokémon abilities in play, in hand and in discard.
  const powerNames = (card: PokemonCard): string[] => {
    const set = new Set<string>(card.powers.map(p => p.name));
    try {
      const check = new CheckPokemonPowersEffect(player, card);
      store.reduceEffect(state, check);
      check.powers.forEach((p: any) => set.add(p.name));
    } catch {
      // ignored
    }
    return Array.from(set).sort();
  };
  own.forEach(target => {
    const card = listFor(state, player, target).getPokemonCard();
    if (card) {
      powerNames(card).forEach(name => out.push({
        desc: { a: 'ability', name, source: tgt(target) },
        action: new UseAbilityAction(player.id, name, target),
      }));
    }
  });
  const zoneAbilities = (slot: SlotType, cards: Card[]) => cards.forEach((card, index) => {
    const target = { player: PlayerType.BOTTOM_PLAYER, slot, index };
    if (card instanceof PokemonCard) {
      card.powers.filter(p => slot === SlotType.HAND ? p.useFromHand : p.useFromDiscard).forEach(p => out.push({
        desc: { a: 'ability', name: p.name, source: tgt(target), card: cardRef(card) },
        action: new UseAbilityAction(player.id, p.name, target),
      }));
    } else if (card instanceof TrainerCard) {
      card.powers.filter(p => slot === SlotType.HAND ? p.useFromHand : p.useFromDiscard).forEach(p => out.push({
        desc: { a: 'trainerAbility', name: p.name, source: tgt(target), card: cardRef(card) },
        action: new UseTrainerAbilityAction(player.id, p.name, target),
      }));
    } else if (card instanceof EnergyCard && slot === SlotType.DISCARD) {
      card.powers.filter(p => p.useFromDiscard).forEach(p => out.push({
        desc: { a: 'energyAbility', name: p.name, source: tgt(target), card: cardRef(card) },
        action: new UseEnergyAbilityAction(player.id, p.name, target),
      }));
    }
  });
  zoneAbilities(SlotType.HAND, player.hand.cards);
  zoneAbilities(SlotType.DISCARD, player.discard.cards);

  if (StateUtils.getStadiumCard(state) !== undefined) {
    out.push({ desc: { a: 'stadium' }, action: new UseStadiumAction(player.id) });
  }

  player.bench.forEach((b, index) => {
    if (b.cards.length > 0) {
      out.push({ desc: { a: 'retreat', bench: index }, action: new RetreatAction(player.id, index) });
    }
  });

  out.push({ desc: { a: 'pass' }, action: new PassTurnAction(player.id) });
  return out;
}

/** Match an action produced by the simple bot to an option. */
export function describeAction(state: State, player: Player, action: Action): any | undefined {
  if (action instanceof PlayCardAction) {
    const card = player.hand.cards[action.handIndex];
    if (!card) {
      return undefined;
    }
    let target = action.target;
    if (card instanceof TrainerCard && card.trainerType !== TrainerType.TOOL) {
      target = BOARD_TARGET;
    }
    return { a: 'play', card: cardRef(card), target: tgt(target) };
  }
  if (action instanceof AttackAction) {
    return { a: 'attack', name: action.name };
  }
  if (action instanceof UseAbilityAction) {
    const d: any = { a: 'ability', name: action.name, source: tgt(action.target) };
    if (action.target.slot === SlotType.HAND) {
      d.card = cardRef(player.hand.cards[action.target.index]);
    } else if (action.target.slot === SlotType.DISCARD) {
      d.card = cardRef(player.discard.cards[action.target.index]);
    }
    return d;
  }
  if (action instanceof UseStadiumAction) {
    return { a: 'stadium' };
  }
  if (action instanceof RetreatAction) {
    return { a: 'retreat', bench: action.benchIndex };
  }
  if (action instanceof PassTurnAction) {
    return { a: 'pass' };
  }
  return undefined;
}
