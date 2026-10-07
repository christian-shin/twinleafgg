import { TrainerCard } from '../../../game/store/card/trainer-card';
import { TrainerType } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { State } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';
import { CheckHpEffect, CheckRetreatCostEffect } from '../../../game/store/effects/check-effects';
import { IS_TOOL_BLOCKED } from '../../../game/store/prefabs/prefabs';


export class EmergencyBoard extends TrainerCard {

  public regulationMark = 'H';

  public trainerType: TrainerType = TrainerType.TOOL;

  public set: string = 'TEF';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '159';

  public name: string = 'Rescue Board';

  public fullName: string = 'Rescue Board TEF';

  public text: string = 'The Retreat Cost of the Pokémon this card is attached to is [C] less. If that Pokémon\'s remaining HP is 30 or less, it has no Retreat Cost.';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof CheckRetreatCostEffect && effect.player.active.tools.includes(this)) {
      const player = effect.player;
      const pokemonCard = player.active.getPokemonCard();

      if (IS_TOOL_BLOCKED(store, state, effect.player, this)) { return state; }

      if (pokemonCard) {
        // Remaining HP uses the current HP (Stadium, Ability and Energy bonuses included)
        const checkHpEffect = new CheckHpEffect(player, player.active);
        store.reduceEffect(state, checkHpEffect);
        const remainingHp = checkHpEffect.hp - player.active.damage;
        if (remainingHp <= 30) {
          effect.cost = [];
          effect.noRetreatCost = true;
        } else {
          effect.costReduction += 1;
        }
      }
      return state;
    }
    return state;
  }
}