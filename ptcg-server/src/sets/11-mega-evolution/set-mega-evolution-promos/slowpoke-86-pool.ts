// Official text (Limitless, MEP 86): Twinleaf's Slowpoke MEP (#70) carries the
// same card under unofficial names; this is the English printing.
import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, SpecialCondition } from '../../../game/store/card/card-types';
import { PowerType, StoreLike, State, StateUtils } from '../../../game';
import { AddSpecialConditionsEffect } from '../../../game/store/effects/attack-effects';
import { AddSpecialConditionsPowerEffect } from '../../../game/store/effects/check-effects';
import { Effect } from '../../../game/store/effects/effect';
import { IS_ABILITY_BLOCKED } from '../../../game/store/prefabs/prefabs';

export class SlowpokeMEP86Pool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [P];
  public hp: number = 80;
  public weakness = [{ type: D }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C, C];

  public powers = [{
    name: 'Dopey Face',
    powerType: PowerType.ABILITY,
    text: 'This Pokémon can\'t be Confused.'
  }];

  public attacks = [{
    name: 'Super Psy Bolt',
    cost: [P, P, C],
    damage: 50,
    text: ''
  }];

  public regulationMark = 'I';
  public set: string = 'MEP';
  public setNumber: string = '86';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Slowpoke';
  public fullName: string = 'Slowpoke MEP 86';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Dopey Face: this Pokémon can't be Confused (an Ability, so ability locks apply).
    if (effect instanceof AddSpecialConditionsEffect || effect instanceof AddSpecialConditionsPowerEffect) {
      if (effect.specialConditions.includes(SpecialCondition.CONFUSED) && effect.target.getPokemonCard() === this) {
        const owner = StateUtils.findOwner(state, effect.target);
        if (!IS_ABILITY_BLOCKED(store, state, owner, this)) {
          effect.preventDefault = true;
        }
      }
    }
    return state;
  }
}
