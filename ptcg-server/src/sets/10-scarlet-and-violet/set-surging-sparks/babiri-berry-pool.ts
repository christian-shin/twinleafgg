import { CardType, State, StateUtils, StoreLike, TrainerCard, TrainerType } from '../../../game';
import { CheckPokemonTypeEffect } from '../../../game/store/effects/check-effects';
import { PutDamageEffect, ignoresDefenderEffects } from '../../../game/store/effects/attack-effects';
import { shouldPreventAttackDamage } from '../../../game/store/effects/effect-of-attack-effects';
import { Effect } from '../../../game/store/effects/effect';
import { IS_TOOL_BLOCKED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';
import { GamePhase } from '../../../game/store/state/state';

// Ref: set-prismatic-evolution/haban-berry.ts
export class BabiriBerrySSPPool extends TrainerCard {
  public regulationMark = 'H';
  public trainerType: TrainerType = TrainerType.TOOL;
  public set: string = 'SSP';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '163';
  public name = 'Babiri Berry';
  public fullName = 'Babiri Berry SSP';
  public text: string = 'If the Pokémon this card is attached to is damaged by an attack from your opponent\'s [M] Pokémon, it takes 60 less damage (after applying Weakness and Resistance), and discard this card.';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof PutDamageEffect && !ignoresDefenderEffects(effect) && effect.target.tools.includes(this)) {
      if (state.phase !== GamePhase.ATTACK) {
        return state;
      }

      const owner = StateUtils.findOwner(state, effect.target);
      if (IS_TOOL_BLOCKED(store, state, owner, this)) {
        return state;
      }

      const attacker = StateUtils.findOwner(state, effect.source);
      if (owner === attacker) {
        return state;
      }

      // "If the Pokémon is damaged": no damage taken (none to begin with, or prevented) -> the Berry stays.
      if (effect.preventDefault || effect.damage <= 0 || shouldPreventAttackDamage(effect.target, effect.source, effect.damage)) {
        return state;
      }

      const checkType = new CheckPokemonTypeEffect(effect.source);
      store.reduceEffect(state, checkType);
      if (!checkType.cardTypes.includes(CardType.METAL)) {
        return state;
      }

      effect.reduceDamage(60);
      return MOVE_CARDS(store, state, effect.target, owner.discard, { cards: [this] });
    }
    return state;
  }
}
