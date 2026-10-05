import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, SpecialCondition } from '../../../game/store/card/card-types';
import { PowerType, State, StoreLike, StateUtils } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { AddSpecialConditionsEffect } from '../../../game/store/effects/attack-effects';
import { AddSpecialConditionsPowerEffect } from '../../../game/store/effects/check-effects';
import { IS_ABILITY_BLOCKED } from '../../../game/store/prefabs/prefabs';

export class Hoothoot extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [C];
  public hp: number = 80;
  public weakness = [{ type: L }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C, C];

  public powers = [{
    name: 'Insomnia',
    powerType: PowerType.ABILITY,
    text: 'This Pokémon can\'t be Asleep.'
  }];

  public attacks =
    [{
      name: 'Tackle',
      cost: [C, C],
      damage: 20,
      text: ''
    }];

  public set: string = 'PRE';
  public regulationMark = 'H';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '77';
  public name: string = 'Hoothoot';
  public fullName: string = 'Hoothoot PRE';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Insomnia: this Pokémon can't be Asleep (only Asleep; other Special Conditions of the same effect still apply)
    if (
      (effect instanceof AddSpecialConditionsEffect || effect instanceof AddSpecialConditionsPowerEffect) &&
      effect.specialConditions.includes(SpecialCondition.ASLEEP) &&
      effect.target.getPokemonCard() === this
    ) {
      const owner = StateUtils.findOwner(state, effect.target);
      if (!IS_ABILITY_BLOCKED(store, state, owner, this)) {
        const remaining = effect.specialConditions.filter(c => c !== SpecialCondition.ASLEEP);
        if (remaining.length === 0) {
          effect.preventDefault = true;
        } else {
          effect.specialConditions = remaining;
        }
      }
    }

    return state;
  }
}
