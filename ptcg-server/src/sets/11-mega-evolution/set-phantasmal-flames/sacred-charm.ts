import { TrainerCard } from '../../../game/store/card/trainer-card';
import { TrainerType } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { State } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';
import { PutDamageEffect, ignoresDefenderEffects } from '../../../game/store/effects/attack-effects';
import { CheckPokemonPowersEffect } from '../../../game/store/effects/check-effects';
import { GamePhase, PowerType, StateUtils } from '../../../game';
import { IS_TOOL_BLOCKED } from '../../../game/store/prefabs/prefabs';

export class SacredCharm extends TrainerCard {
  public trainerType: TrainerType = TrainerType.TOOL;
  public regulationMark = 'I';
  public set: string = 'PFL';
  public name: string = 'Sacred Charm';
  public fullName: string = 'Sacred Charm M2';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '93';
  public text: string = 'The Pokémon this card is attached to takes 30 less damage from attacks from your opponent\'s Pokémon that have any Abilities.';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {

    // Reduce damage after Weakness and Resistance (PutDamageEffect), like Rigid Band
    if (effect instanceof PutDamageEffect && !ignoresDefenderEffects(effect) && effect.target.tools.includes(this)) {
      if (state.phase !== GamePhase.ATTACK) {
        return state;
      }

      const owner = StateUtils.findOwner(state, effect.target);
      if (IS_TOOL_BLOCKED(store, state, owner, this)) {
        return state;
      }

      // Only attacks from the opponent's Pokémon
      const attacker = StateUtils.findOwner(state, effect.source);
      if (owner === attacker) {
        return state;
      }

      // effect.source is the attacker's PokemonCardList: check its Pokémon for any Ability
      const sourcePokemon = effect.source.getPokemonCard();
      if (sourcePokemon === undefined) {
        return state;
      }

      const powersEffect = new CheckPokemonPowersEffect(attacker, sourcePokemon);
      state = store.reduceEffect(state, powersEffect);
      if (powersEffect.powers.some(power => power.powerType === PowerType.ABILITY)) {
        effect.reduceDamage(30);
      }
    }

    return state;
  }
}
