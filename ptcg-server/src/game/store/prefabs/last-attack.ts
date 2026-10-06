import { PokemonCard } from '../card/pokemon-card';
import { AttackEffect, KnockOutEffect } from '../effects/game-effects';
import { Player } from '../state/player';
import { PokemonCardList } from '../state/pokemon-card-list';
import { GamePhase, State } from '../state/state';

/**
 * The attack in progress and what it damaged, kept until the Knock Out check (step 8 of the attack flow
 * chart, which runs after the attack's effects are over). Effects that trigger on a Knocked Out Pokémon
 * (Maractus' Explosive Needle, Mega Gengar ex's Shadowy Concealment, Briar, Little Grudge) need to know which
 * Pokémon used the attack and whether the Knocked Out Pokémon was damaged while in the Active Spot, wherever
 * they are by then (rulings 1547, 1631). Not part of the game state; reset when an attack starts, like the
 * Pokémon that survived on 10 HP.
 */
interface LastAttack {
  player: Player;
  source: PokemonCardList;
  sourcePokemon: PokemonCard | undefined;
  damagedActive: PokemonCardList[];
}

let last: LastAttack | undefined;

export function BEGIN_LAST_ATTACK(effect: AttackEffect) {
  last = {
    player: effect.player,
    source: effect.source,
    sourcePokemon: effect.source.getPokemonCard(),
    damagedActive: [],
  };
}

/** The opponent's Active Pokémon was damaged by the attack in progress. */
export function RECORD_ACTIVE_DAMAGED(target: PokemonCardList) {
  if (last !== undefined && !last.damagedActive.includes(target)) {
    last.damagedActive.push(target);
  }
}

export interface AttackThatKnockedOut {
  /** The Pokémon card that used the attack (also when it already left play). */
  pokemon: PokemonCard | undefined;
  /** Where it is in play now; undefined when it left play. */
  list: PokemonCardList | undefined;
}

/**
 * The Pokémon that used the opponent's attack in progress, when a Pokémon of `effect.player` is being Knocked Out
 * during it (also when it left play or was switched to the Bench by the attack's effects); undefined outside an
 * attack of the opponent.
 */
export function ATTACKER_OF_KNOCK_OUT(state: State, effect: KnockOutEffect): AttackThatKnockedOut | undefined {
  if (last === undefined || state.phase !== GamePhase.ATTACK) {
    return undefined;
  }
  if (state.players[state.activePlayer] === effect.player || last.player === effect.player) {
    return undefined;
  }
  const inPlay = last.sourcePokemon !== undefined && last.source.getPokemonCard() === last.sourcePokemon;
  return { pokemon: last.sourcePokemon, list: inPlay ? last.source : undefined };
}

/**
 * The attacker of the opponent's attack that damaged the Pokémon being Knocked Out while it was in the Active
 * Spot, or undefined when this Knock Out isn't a Knock Out by damage from an attack.
 */
export function ATTACK_THAT_DAMAGED_KNOCKED_OUT(state: State, effect: KnockOutEffect): AttackThatKnockedOut | undefined {
  const attack = ATTACKER_OF_KNOCK_OUT(state, effect);
  if (attack === undefined || last === undefined || !last.damagedActive.includes(effect.target)) {
    return undefined;
  }
  return attack;
}
