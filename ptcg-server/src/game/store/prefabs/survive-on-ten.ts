import { PokemonCardList } from '../state/pokemon-card-list';
import { CheckHpEffect } from '../effects/check-effects';
import { State } from '../state/state';
import { StoreLike } from '../store-like';
import { Player } from '../state/player';

/**
 * Pokémon that survived an attack's damage with "its remaining HP becomes 10" (Resolute Heart,
 * Focus Sash, ...) during the attack in progress. When an effect of the same attack lowers the
 * Pokémon's maximum HP afterwards (it discards the Stadium or Tool that gave +HP), the remaining
 * HP stays 10 until the Knock Out check (ruling 1589: Pikachu ex survives with 190 damage).
 * Cleared when an attack starts.
 */
let survivors: PokemonCardList[] = [];

export function CLEAR_TEN_HP_SURVIVORS() {
  survivors = [];
}

export function ADD_TEN_HP_SURVIVOR(target: PokemonCardList) {
  if (!survivors.includes(target)) {
    survivors.push(target);
  }
}

export function KEEP_TEN_HP_SURVIVORS(store: StoreLike, state: State, player: Player) {
  const list = survivors;
  survivors = [];
  for (const target of list) {
    if (target.getPokemonCard() === undefined) {
      continue;
    }
    const checkHpEffect = new CheckHpEffect(player, target);
    store.reduceEffect(state, checkHpEffect);
    if (target.damage >= checkHpEffect.hp) {
      target.damage = checkHpEffect.hp - 10;
    }
  }
}
