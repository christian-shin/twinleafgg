import { SuperType } from '../card/card-types';
import { CardsToHandEffect, DiscardCardsEffect, DiscardCardsFromOpponentsActivePokemonEffect, LostZoneCardsEffect, MoveOpponentEnergyEffect } from '../effects/attack-effects';
import { Effect } from '../effects/effect';
import { AttackEffect, MoveCardsEffect } from '../effects/game-effects';
import { State } from '../state/state';
import { StoreLike } from '../store-like';

/**
 * Energy removed from a Pokémon as part of an attack's effect (discarded, shuffled into the deck,
 * put into the hand or the Lost Zone, or moved to another Pokémon) leaves it after the damage is done: the player chooses the
 * Energy first, then the damage is done (with the Energy still attached: Double Turbo Energy,
 * Bastiodon's Ancient Bulwark, Spiky Energy, ...), then the Energy is removed
 * (attack flow chart; rulings 1553, 1580, 1846, 1874).
 *
 * The attack flow opens the window (`afterDamageEffects`) before it reduces the AttackEffect and
 * runs the queued effects after the damage. Inside the window `store.reduceEffect` queues such an
 * effect instead of reducing it (`DEFER_UNTIL_AFTER_DAMAGE`).
 */
export function OPEN_AFTER_DAMAGE_EFFECTS(attackEffect: AttackEffect): void {
  attackEffect.afterDamageEffects = [];
}

/**
 * @returns true when the effect was queued until after the damage (the caller then skips it).
 */
export function DEFER_UNTIL_AFTER_DAMAGE(store: StoreLike, effect: Effect): boolean {
  let attackEffect: AttackEffect | undefined;
  if (effect instanceof DiscardCardsEffect
    || effect instanceof DiscardCardsFromOpponentsActivePokemonEffect
    || effect instanceof LostZoneCardsEffect
    || effect instanceof CardsToHandEffect) {
    // An empty list is a probe ("is this prevented?"), not a removal: it is reduced at once
    if (effect.cards.length === 0 || !effect.cards.every(card => card.superType === SuperType.ENERGY)) {
      return false;
    }
    attackEffect = effect.attackEffect;
  } else if (effect instanceof MoveOpponentEnergyEffect) {
    if (effect.card.superType !== SuperType.ENERGY) {
      return false;
    }
    attackEffect = effect.attackEffect;
  } else if (effect instanceof MoveCardsEffect) {
    attackEffect = effect.afterDamageOf;
  } else {
    return false;
  }
  if (attackEffect === undefined || attackEffect.afterDamageEffects === undefined) {
    return false;
  }
  const deferred = effect;
  attackEffect.afterDamageEffects.push(state => store.reduceEffect(state, deferred));
  return true;
}

/**
 * Run `step` after the damage of the attack when its window is open (it needs the Energy removed
 * before, such as the shuffle that follows Energy put into the deck), now otherwise.
 */
export function AFTER_DAMAGE_OR_NOW(state: State, attackEffect: AttackEffect, step: (state: State) => State): State {
  if (attackEffect.afterDamageEffects === undefined) {
    return step(state);
  }
  attackEffect.afterDamageEffects.push(step);
  return state;
}

export function RUN_AFTER_DAMAGE_EFFECTS(state: State, attackEffect: AttackEffect): State {
  const queued = attackEffect.afterDamageEffects;
  attackEffect.afterDamageEffects = undefined;
  for (const step of queued || []) {
    state = step(state);
  }
  return state;
}
