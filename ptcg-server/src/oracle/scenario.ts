/**
 * Scenarios: reach rare card branches deterministically instead of by random
 * play. A normal game runs from seed and decks; at the first turn decision on
 * or after `turn`, these edits are applied to the live state, then play
 * continues as usual. The Rust replay applies the same edits at the same
 * point (engine/src/scenario.rs) and checks the state hash right after them.
 *
 *   {
 *     "turn": 2,                       // default 2 (first turn that can attack)
 *     "me":  { ... },                  // the player whose turn it is then
 *     "opp": { ... }
 *   }
 *
 * Each side (applied in this order, `me` first):
 *   "hand_to_deck": true                the whole hand moved to the bottom of the deck
 *   "discard": ["Name", ...]            cards moved to the discard pile
 *   "hand":    ["Name", ...]            cards moved to the hand
 *   "active":  "Name"                   a Pokémon put on the first empty Bench
 *                                       spot, then switched into the Active Spot
 *   "active_energy": ["Name", ...]      cards attached to the Active Pokémon
 *   "active_damage": 30                 the Active Pokémon's damage
 *   "bench": [{ "card": "Name", "energy": [...], "damage": 0 }, ...]
 *                                       Pokémon put on the next empty Bench spots
 *
 * Names are Twinleaf full names. Each card is taken from the deck (first match
 * from the top), else from the hand; a missing card is an error. Only the
 * engines' own primitives are used: `CardList.moveTo` / `moveCardTo`,
 * `PokemonCardList.damage` and `Player.switchPokemon`.
 */
import { Card } from '../game/store/card/card';
import { CardList } from '../game/store/state/card-list';
import { PokemonCardList } from '../game/store/state/pokemon-card-list';
import { Player } from '../game/store/state/player';
import { State } from '../game/store/state/state';
import { StoreLike } from '../game/store/store-like';

export interface ScenarioBench {
  card: string;
  energy?: string[];
  damage?: number;
}

export interface ScenarioSide {
  hand_to_deck?: boolean;
  discard?: string[];
  hand?: string[];
  active?: string;
  active_energy?: string[];
  active_damage?: number;
  bench?: ScenarioBench[];
}

export interface Scenario {
  turn?: number;
  me?: ScenarioSide;
  opp?: ScenarioSide;
}

export function scenarioTurn(sc: Scenario): number {
  return sc.turn ?? 2;
}

function take(player: Player, name: string): { from: CardList, card: Card } {
  for (const from of [player.deck, player.hand]) {
    const card = from.cards.find(c => c.fullName === name);
    if (card !== undefined) {
      return { from, card };
    }
  }
  throw new Error('scenario: no ' + name + ' in deck or hand');
}

function move(player: Player, name: string, dest: CardList): void {
  const { from, card } = take(player, name);
  from.moveCardTo(card, dest);
}

function emptyBench(player: Player): PokemonCardList {
  const slot = player.bench.find(b => b.cards.length === 0);
  if (slot === undefined) {
    throw new Error('scenario: no empty Bench spot');
  }
  return slot;
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
  if (side.active !== undefined) {
    const slot = emptyBench(player);
    move(player, side.active, slot);
    player.switchPokemon(slot, store, state);
  }
  for (const n of side.active_energy ?? []) {
    move(player, n, player.active);
  }
  if (side.active_damage !== undefined) {
    player.active.damage = side.active_damage;
  }
  for (const b of side.bench ?? []) {
    const slot = emptyBench(player);
    move(player, b.card, slot);
    for (const n of b.energy ?? []) {
      move(player, n, slot);
    }
    if (b.damage !== undefined) {
      slot.damage = b.damage;
    }
  }
}

export function applyScenario(store: StoreLike, state: State, sc: Scenario): void {
  const me = state.players[state.activePlayer];
  const opp = state.players[1 - state.activePlayer];
  applySide(store, state, me, sc.me ?? {});
  applySide(store, state, opp, sc.opp ?? {});
}
