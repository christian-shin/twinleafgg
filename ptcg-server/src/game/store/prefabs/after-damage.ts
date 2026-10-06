import { SuperType } from '../card/card-types';
import { AfterDamageEffect, AttackTriggerEffect, CardsToHandEffect, DiscardCardsEffect, DiscardCardsFromOpponentsActivePokemonEffect, LostZoneCardsEffect, MoveOpponentEnergyEffect } from '../effects/attack-effects';
import { Card } from '../card/card';
import { GameMessage } from '../../game-message';
import { SelectPrompt } from '../prompts/select-prompt';
import { Effect } from '../effects/effect';
import { AttackEffect, AttackTrigger, MoveCardsEffect } from '../effects/game-effects';
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
  attackEffect.attackTriggers = [];
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

/**
 * Step 7 of the attack flow chart: "resolve effects of the opponent's Active Pokémon, effects that activate
 * when a Pokémon receives the attack". The effect of `card` on the damaged Pokémon is recorded when the damage
 * is done (the cards call this from AfterDamageEffect once they know they apply: damage above 0, the damaged
 * Pokémon in the Active Spot, an opponent's attack) and resolves in RUN_ATTACK_TRIGGERS, after every effect of
 * the attack's text and its prompts. Pending triggers resolve in the order they were recorded (the order the
 * damage was done, then the order the cards react to the AfterDamageEffect). Outside an attack flow with an open
 * window the trigger resolves at once.
 *
 * The card then re-checks, when its AttackTriggerEffect reaches it, that it is still attached to the damaged
 * Pokémon (a discard by the attack stops it, ruling 1649) and not blocked.
 */
export function ATTACK_TRIGGER(
  store: StoreLike,
  state: State,
  effect: AfterDamageEffect,
  card: Card,
  retaliate?: AttackTrigger['retaliate'],
  removesAttackerEnergy: boolean = false,
): State {
  const trigger: AttackTrigger = {
    card,
    target: effect.target,
    damage: effect.damage,
    source: effect.source,
    sourcePokemon: effect.source.getPokemonCard(),
    retaliate,
    removesAttackerEnergy,
  };
  const attackEffect = effect.attackEffect;
  if (attackEffect.attackTriggers !== undefined) {
    attackEffect.attackTriggers.push(trigger);
    return state;
  }
  return store.reduceEffect(state, new AttackTriggerEffect(attackEffect, trigger));
}

/**
 * Two pending triggers can give different results when resolved in a different order: Handheld Fan moves an
 * Energy off the Attacking Pokémon, which can be the Mist Energy that blocks a delayed trap (Bouffalant, ...).
 * All other triggers of the pool commute (damage counters on the attacker add up, a Burn, a draw).
 */
function ordersMatter(list: AttackTrigger[]): boolean {
  for (const a of list) {
    for (const b of list) {
      if (a.removesAttackerEnergy === true && b.retaliate !== undefined
        && b.sourcePokemon !== undefined && b.source.getPokemonCard() === b.sourcePokemon
        && b.source.cards.some(c => c.superType === SuperType.ENERGY && c.name === 'Mist Energy')) {
        return true;
      }
    }
  }
  return false;
}

/** There are step 7 triggers left to resolve. */
export function ATTACK_TRIGGERS_PENDING(attackEffect: AttackEffect): boolean {
  return attackEffect.attackTriggers !== undefined && attackEffect.attackTriggers.length > 0;
}

/**
 * Resolve the next recorded step 7 trigger (Advanced Player's Rulebook E-03: when several activate at the same
 * time, the owner of the damaged Pokémon chooses the order). They resolve in the order they were recorded, except
 * that the defending player picks which one goes first (a SelectPrompt over the cards' names) while 2 or more are
 * pending and the order matters (`ordersMatter`). A trigger that opens a prompt is resolved (the prompt answered)
 * before the next one starts: the caller waits for prompts between calls.
 */
export function RESOLVE_NEXT_ATTACK_TRIGGER(store: StoreLike, state: State, attackEffect: AttackEffect): State {
  const list = attackEffect.attackTriggers;
  if (list === undefined || list.length === 0) {
    return state;
  }
  if (list.length >= 2 && ordersMatter(list)) {
    return store.prompt(state, new SelectPrompt(
      attackEffect.opponent.id,
      GameMessage.CHOOSE_OPTION,
      list.map(t => t.card.fullName),
      { allowCancel: false }
    ), choice => {
      const [trigger] = list.splice(choice, 1);
      state = store.reduceEffect(state, new AttackTriggerEffect(attackEffect, trigger));
    });
  }
  const trigger = list.shift()!;
  return store.reduceEffect(state, new AttackTriggerEffect(attackEffect, trigger));
}

/** Resolve every recorded step 7 trigger in the order recorded (no choice, no waiting for prompts). */
export function RUN_ATTACK_TRIGGERS(store: StoreLike, state: State, attackEffect: AttackEffect): State {
  const queued = attackEffect.attackTriggers;
  attackEffect.attackTriggers = undefined;
  for (const trigger of queued || []) {
    state = store.reduceEffect(state, new AttackTriggerEffect(attackEffect, trigger));
  }
  return state;
}

/** Close the step 7 trigger window of the attack. */
export function CLOSE_ATTACK_TRIGGERS(attackEffect: AttackEffect): void {
  attackEffect.attackTriggers = undefined;
}
