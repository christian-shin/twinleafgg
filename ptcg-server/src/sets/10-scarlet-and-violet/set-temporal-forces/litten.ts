import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, SpecialCondition } from '../../../game/store/card/card-types';
import { StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';

import { AddSpecialConditionsEffect } from '../../../game/store/effects/attack-effects';
import { COIN_FLIP_PROMPT, AFTER_ATTACK } from '../../../game/store/prefabs/prefabs';

export class Litten extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [R];
  public hp: number = 70;
  public weakness = [{ type: W }];
  public retreat = [C, C];

  public attacks = [{
    name: 'Fake Out', cost: [R], damage: 10, text: 'Flip a coin. If heads, your opponent\'s Active Pokémon is now Paralyzed. '
  }];

  public set: string = 'TEF';
  public setNumber = '32';
  public cardImage = 'assets/cardback.png';

  public regulationMark: string = 'H';

  public name: string = 'Litten';
  public fullName: string = 'Litten TEF';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (AFTER_ATTACK(effect, 0, this)) {
      const player = effect.player;

      return COIN_FLIP_PROMPT(store, state, player, result => {
        if (result) {
          const specialCondition = new AddSpecialConditionsEffect(effect.attackEffect, [SpecialCondition.PARALYZED]);
          return store.reduceEffect(state, specialCondition);
        }
      });
    }

    return state;
  }

}
