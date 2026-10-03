/**
 * Scenarios: reach rare card branches deterministically instead of by random
 * play. A normal game runs from seed and decks; at the first turn decision on
 * or after `turn`, these edits are applied to the live state, then play
 * continues. The Rust replay applies the same edits at the same point
 * (engine/src/scenario.rs, kept identical) and checks the state hash right
 * after them. Format and examples: engine/CARD_PORTING.md, "Scenarios".
 *
 *   {
 *     "turn": 2,                 // default 2 (first turn that can attack)
 *     "me":  { side edits },     // the player whose turn it is then
 *     "opp": { side edits },
 *     "coins": [true, false],    // the next real coin flips (heads = true)
 *     "answers": [ ... ]         // the next decisions, in trace answer format
 *   }
 *
 * Side edits, applied in this order (`me` first):
 *   reset: true                  (done for both players before any other edit)
 *                                every card the player has (hand, discard, Prizes,
 *                                Stadium, Bench, Active, attachments) back to the
 *                                deck and every Pokémon slot emptied, so the board
 *                                is built from scratch; requires `active`; Prizes
 *                                not named in `prizes` are refilled from the top
 *                                of the deck after all other edits
 *   hand_to_deck: true           whole hand to the bottom of the deck
 *   discard / hand: [names]      cards moved there
 *   deck_top: [names]            cards moved to the top of the deck, first = top
 *   prizes: [names]              Prize i's card goes to the bottom of the deck,
 *                                the named card takes its place
 *   stadium: name                put into play (no Stadium may be in play)
 *   active: name | [names]       a Pokémon (or an evolution stack, Basic first)
 *                                put on an empty Bench spot, then switched in
 *   active_energy: [names]       attached to the Active Pokémon
 *   active_tool: name            attached as a Tool
 *   active_damage: n
 *   active_conditions: ["POISONED", ...]   PARALYZED CONFUSED ASLEEP POISONED BURNED
 *   active_played: "this_turn" | "earlier" (default "earlier")
 *   bench: [{card: name | [names], energy, tool, damage, conditions, played}]
 *   supporter_played / energy_attached / retreated: true   this turn's flags
 *   prizes_left: N               after every other edit, Prizes N..5 go to the
 *                                bottom of the deck (N Prize cards left)
 *
 * Every card is taken from the deck (first match from the top), else the
 * hand; a missing card is an error. Only the engines' own primitives are used
 * (`moveTo`, `moveCardTo`, `switchPokemon`, `addSpecialCondition`, plain
 * fields), so nothing here models game rules.
 */
import { Card } from '../game/store/card/card';
import { SpecialCondition } from '../game/store/card/card-types';
import { CardList } from '../game/store/state/card-list';
import { PokemonCardList } from '../game/store/state/pokemon-card-list';
import { Player } from '../game/store/state/player';
import { State } from '../game/store/state/state';
import { StoreLike } from '../game/store/store-like';
import { Chance } from '../game/core/chance';
import { resetEmptyPokemonSlot } from '../game/store/effect-reducers/game-effect';

type Stack = string | string[];

export interface ScenarioPokemon {
  card: Stack;
  energy?: string[];
  tool?: string;
  damage?: number;
  conditions?: string[];
  played?: 'this_turn' | 'earlier';
}

export interface ScenarioSide {
  reset?: boolean;
  hand_to_deck?: boolean;
  discard?: string[];
  hand?: string[];
  deck_top?: string[];
  prizes?: string[];
  stadium?: string;
  active?: Stack;
  active_energy?: string[];
  active_tool?: string;
  active_damage?: number;
  active_conditions?: string[];
  active_played?: 'this_turn' | 'earlier';
  bench?: ScenarioPokemon[];
  supporter_played?: boolean;
  energy_attached?: boolean;
  retreated?: boolean;
  prizes_left?: number;
}

export interface Scenario {
  turn?: number;
  me?: ScenarioSide;
  opp?: ScenarioSide;
  coins?: boolean[];
  answers?: any[];
}

export function scenarioTurn(sc: Scenario): number {
  return sc.turn ?? 2;
}

const CONDITIONS: { [k: string]: SpecialCondition } = {
  PARALYZED: SpecialCondition.PARALYZED,
  CONFUSED: SpecialCondition.CONFUSED,
  ASLEEP: SpecialCondition.ASLEEP,
  POISONED: SpecialCondition.POISONED,
  BURNED: SpecialCondition.BURNED,
};

function take(player: Player, name: string): { from: CardList, card: Card } {
  for (const from of [player.deck, player.hand]) {
    const card = from.cards.find(c => c.fullName === name);
    if (card !== undefined) {
      return { from, card };
    }
  }
  throw new Error('scenario: no ' + name + ' in deck or hand');
}

function move(player: Player, name: string, dest: CardList): Card {
  const { from, card } = take(player, name);
  from.moveCardTo(card, dest);
  return card;
}

function emptyBench(player: Player): PokemonCardList {
  const slot = player.bench.find(b => b.cards.length === 0);
  if (slot === undefined) {
    throw new Error('scenario: no empty Bench spot');
  }
  return slot;
}

function stack(s: Stack): string[] {
  return typeof s === 'string' ? [s] : s;
}

/** Energy, Tool, damage, conditions and played turn of a Pokémon in play. */
function dress(state: State, player: Player, slot: PokemonCardList, p: {
  energy?: string[], tool?: string, damage?: number, conditions?: string[], played?: string
}): void {
  for (const n of p.energy ?? []) {
    move(player, n, slot);
  }
  if (p.tool !== undefined) {
    const card = move(player, p.tool, slot);
    const i = slot.cards.indexOf(card);
    if (i !== -1) {
      slot.cards.splice(i, 1);
    }
    slot.tools.push(card as any);
  }
  if (p.damage !== undefined) {
    slot.damage = p.damage;
  }
  for (const c of p.conditions ?? []) {
    if (!(c in CONDITIONS)) {
      throw new Error('scenario: unknown condition ' + c);
    }
    slot.addSpecialCondition(CONDITIONS[c]);
  }
  slot.pokemonPlayedTurn = p.played === 'this_turn' ? state.turn : 0;
}

/** `reset`: everything back to the deck, every slot emptied (bench first, then Active). */
function resetPlayer(player: Player): void {
  player.hand.moveTo(player.deck);
  player.discard.moveTo(player.deck);
  for (const prize of player.prizes) {
    prize.moveTo(player.deck);
  }
  player.stadium.moveTo(player.deck);
  for (const slot of [...player.bench, player.active]) {
    for (const card of [...slot.cards, ...slot.tools]) {
      slot.moveCardTo(card, player.deck);
    }
    resetEmptyPokemonSlot(slot);
  }
}

function applySide(store: StoreLike, state: State, player: Player, side: ScenarioSide): void {
  if (side.hand_to_deck) {
    player.hand.moveTo(player.deck);
  }
  for (const n of side.discard ?? []) {
    move(player, n, player.discard);
  }
  for (const n of side.hand ?? []) {
    move(player, n, player.hand);
  }
  for (const n of (side.deck_top ?? []).slice().reverse()) {
    const { from, card } = take(player, n);
    from.cards.splice(from.cards.indexOf(card), 1);
    player.deck.cards.unshift(card);
  }
  (side.prizes ?? []).forEach((n, i) => {
    if (i >= player.prizes.length) {
      throw new Error('scenario: no Prize ' + i);
    }
    player.prizes[i].moveTo(player.deck);
    move(player, n, player.prizes[i]);
  });
  if (side.stadium !== undefined) {
    if (state.players.some(pl => pl.stadium.cards.length > 0)) {
      throw new Error('scenario: a Stadium is already in play');
    }
    move(player, side.stadium, player.stadium);
  }
  if (side.active !== undefined && player.active.cards.length === 0) {
    // After `reset`: the Active Spot is empty, so fill it directly.
    for (const n of stack(side.active)) {
      move(player, n, player.active);
    }
    dress(state, player, player.active, {
      energy: side.active_energy, tool: side.active_tool, damage: side.active_damage,
      conditions: side.active_conditions, played: side.active_played,
    });
  } else if (side.active !== undefined) {
    const slot = emptyBench(player);
    for (const n of stack(side.active)) {
      move(player, n, slot);
    }
    player.switchPokemon(slot, store, state);
    dress(state, player, player.active, {
      energy: side.active_energy, tool: side.active_tool, damage: side.active_damage,
      conditions: side.active_conditions, played: side.active_played,
    });
  } else {
    for (const n of side.active_energy ?? []) {
      move(player, n, player.active);
    }
    if (side.active_damage !== undefined) {
      player.active.damage = side.active_damage;
    }
    for (const c of side.active_conditions ?? []) {
      if (!(c in CONDITIONS)) {
        throw new Error('scenario: unknown condition ' + c);
      }
      player.active.addSpecialCondition(CONDITIONS[c]);
    }
  }
  for (const b of side.bench ?? []) {
    const slot = emptyBench(player);
    for (const n of stack(b.card)) {
      move(player, n, slot);
    }
    dress(state, player, slot, b);
  }
  if (side.supporter_played) {
    player.supporterTurn = state.turn;
  }
  if (side.energy_attached) {
    player.energyPlayedTurn = state.turn;
  }
  if (side.retreated) {
    player.retreatedTurn = state.turn;
  }
  if (side.reset) {
    // Prizes not named are refilled from the top of the deck, last.
    for (const prize of player.prizes) {
      if (prize.cards.length === 0) {
        player.deck.moveTo(prize, 1);
      }
    }
  }
  if (side.prizes_left !== undefined) {
    if (side.prizes_left < 0 || side.prizes_left > player.prizes.length) {
      throw new Error('scenario: prizes_left out of range');
    }
    for (let i = side.prizes_left; i < player.prizes.length; i++) {
      player.prizes[i].moveTo(player.deck);
    }
  }
}

export function applyScenario(store: StoreLike, state: State, sc: Scenario): void {
  const me = state.players[state.activePlayer];
  const opp = state.players[1 - state.activePlayer];
  // Resets first (both players), so later edits see the cleared board.
  for (const [player, side] of [[me, sc.me ?? {}], [opp, sc.opp ?? {}]] as [Player, ScenarioSide][]) {
    if (side.reset) {
      if (side.active === undefined) {
        throw new Error('scenario: reset needs an active Pokemon');
      }
      resetPlayer(player);
    }
  }
  applySide(store, state, me, sc.me ?? {});
  applySide(store, state, opp, sc.opp ?? {});
  Chance.force(sc.coins ?? []);
}
