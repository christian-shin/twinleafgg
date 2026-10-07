import { PokemonCard, Stage, CardType, CardTag, SpecialCondition, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { AddSpecialConditionsEffect } from '../../../game/store/effects/attack-effects';
import { WAS_ATTACK_USED, AFTER_ATTACK } from '../../../game/store/prefabs/prefabs';
import { DISCARD_UP_TO_X_ENERGY_FROM_THIS_POKEMON } from '../../../game/store/prefabs/costs';

export class TeamRocketsHoundoomDRIPool extends PokemonCard {
  protected _tags = [CardTag.TEAM_ROCKET];
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom: string = 'Team Rocket\'s Houndour';
  public cardType: CardType[] = [R];
  public hp: number = 130;
  public weakness = [{ type: W }];
  public resistance = [];
  public retreat = [C, C];

  public attacks = [{
    name: 'Cruel Coal',
    cost: [R],
    damage: 0,
    text: 'Your opponent\'s Active Pokémon is now Burned and Confused.'
  }, {
    name: 'Scorching Fire',
    cost: [R, C],
    damage: 120,
    text: 'Discard an Energy from this Pokémon.'
  }];

  public regulationMark = 'I';
  public set: string = 'DRI';
  public setNumber: string = '38';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Team Rocket\'s Houndoom';
  public fullName: string = 'Team Rocket\'s Houndoom DRI';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Cruel Coal
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const specialCondition = new AddSpecialConditionsEffect(effect, [SpecialCondition.BURNED, SpecialCondition.CONFUSED]);
      store.reduceEffect(state, specialCondition);
    }

    // Scorching Fire
    if (AFTER_ATTACK(effect, 1, this)) {
      return DISCARD_UP_TO_X_ENERGY_FROM_THIS_POKEMON(store, state, effect.attackEffect, 1, {}, 1);
    }
    return state;
  }
}
