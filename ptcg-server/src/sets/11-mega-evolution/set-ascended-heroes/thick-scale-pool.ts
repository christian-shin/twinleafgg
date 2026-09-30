import { CardType, State, StateUtils, StoreLike, TrainerCard, TrainerType } from '../../../game';
import { CheckPokemonTypeEffect } from '../../../game/store/effects/check-effects';
import { PutDamageEffect } from '../../../game/store/effects/attack-effects';
import { Effect } from '../../../game/store/effects/effect';
import { IS_TOOL_BLOCKED } from '../../../game/store/prefabs/prefabs';
import { GamePhase } from '../../../game/store/state/state';

// Ref: set-prismatic-evolution/haban-berry.ts (type-conditioned damage reduction on PutDamageEffect)
export class ThickScaleASCPool extends TrainerCard {
  public regulationMark = 'I';
  public trainerType: TrainerType = TrainerType.TOOL;
  public set: string = 'ASC';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '211';
  public name = 'Thick Scale';
  public fullName = 'Thick Scale ASC';
  public text: string = 'The [N] Pokémon this card is attached to takes 50 less damage from attacks from your opponent\'s [G], [R], [W], or [L] Pokémon (after applying Weakness and Resistance).';

  private readonly attackerTypes: CardType[] = [CardType.GRASS, CardType.FIRE, CardType.WATER, CardType.LIGHTNING];

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof PutDamageEffect && effect.target.tools.includes(this)) {
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

      const holderType = new CheckPokemonTypeEffect(effect.target);
      store.reduceEffect(state, holderType);
      if (!holderType.cardTypes.includes(CardType.DRAGON)) {
        return state;
      }

      const sourceType = new CheckPokemonTypeEffect(effect.source);
      store.reduceEffect(state, sourceType);
      if (!sourceType.cardTypes.some(t => this.attackerTypes.includes(t))) {
        return state;
      }

      effect.reduceDamage(50);
    }
    return state;
  }
}
