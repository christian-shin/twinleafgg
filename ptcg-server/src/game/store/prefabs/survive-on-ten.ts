import { PokemonCardList } from '../state/pokemon-card-list';
import { CheckHpEffect } from '../effects/check-effects';
import { State } from '../state/state';
import { StoreLike } from '../store-like';
import { Player } from '../state/player';
import { CoinFlipEffect } from '../effects/play-card-effects';
import { GameLog } from '../../game-message';

/**
 * Pokémon that survived an attack's damage with "its remaining HP becomes 10" (Resolute Heart,
 * Focus Sash, ...) during the attack in progress. When an effect of the same attack lowers the
 * Pokémon's maximum HP afterwards (it discards the Stadium or Tool that gave +HP), the remaining
 * HP stays 10 until the Knock Out check (ruling 1589: Pikachu ex survives with 190 damage).
 * Cleared when an attack starts.
 */
let survivors: PokemonCardList[] = [];

/**
 * Pokémon whose "if this Pokémon would be Knocked Out by damage from an attack, flip a coin" Ability
 * (Tenacious Body, Durable Body) is waiting for the attack's damage to be done. The full damage is
 * done first; the coin is flipped and the 10 HP restored AFTER all the damage (ruling 1770).
 */
let pendingCoins: { target: PokemonCardList; owner: Player; reason: string }[] = [];

export function CLEAR_TEN_HP_SURVIVORS() {
  survivors = [];
  pendingCoins = [];
}

export function ADD_PENDING_SURVIVE_COIN(target: PokemonCardList, owner: Player, reason: string) {
  if (!pendingCoins.some(c => c.target === target)) {
    pendingCoins.push({ target, owner, reason });
  }
}

/**
 * Flip the coins of the Pokémon that took lethal damage from the attack, once all its damage is done
 * (ruling 1770): heads, the Pokémon is not Knocked Out and its remaining HP becomes 10.
 */
export function RESOLVE_SURVIVE_COIN_FLIPS(store: StoreLike, state: State) {
  const list = pendingCoins;
  pendingCoins = [];
  for (const pending of list) {
    const targetCard = pending.target.getPokemonCard();
    if (targetCard === undefined) {
      continue;
    }
    const checkHpEffect = new CheckHpEffect(pending.owner, pending.target);
    store.reduceEffect(state, checkHpEffect);
    if (pending.target.damage < checkHpEffect.hp) {
      continue;
    }
    const coinFlip = new CoinFlipEffect(pending.owner);
    store.reduceEffect(state, coinFlip);
    if (coinFlip.result === true) {
      store.log(state, GameLog.LOG_SURVIVES_ON_TEN_HP, {
        pokemon: targetCard.name,
        reason: pending.reason,
      });
      pending.target.damage = checkHpEffect.hp - 10;
      ADD_TEN_HP_SURVIVOR(pending.target);
    }
  }
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
