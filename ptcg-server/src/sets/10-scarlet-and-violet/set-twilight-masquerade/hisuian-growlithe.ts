import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType } from '../../../game/store/card/card-types';
import { StoreLike, State, StateUtils } from '../../../game';

import { Effect } from '../../../game/store/effects/effect';
import { DealDamageEffect } from '../../../game/store/effects/attack-effects';
import {WAS_ATTACK_USED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

export class HisuianGrowlithe extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [F];
  public hp: number = 80;
  public weakness = [{ type: G }];
  public retreat = [CardType.COLORLESS, CardType.COLORLESS];

  public attacks = [
    {
      name: 'Blazing Destruction',
      cost: [],
      damage: 0,
      text: 'Discard a Stadium in play.'
    },
    {
      name: 'Take Down',
      cost: [F, C],
      damage: 40,
      text: 'This Pokémon also does 10 damage to itself.'
    }
  ];

  public set: string = 'TWM';
  public name: string = 'Hisuian Growlithe';
  public fullName: string = 'Hisuian Growlithe TWM';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '99';
  public regulationMark = 'H';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const stadiumCard = StateUtils.getStadiumCard(state);

      if (!stadiumCard) {
        // An attack can be used even if it has no effect (no Stadium in play: nothing to discard)
        return state;
      } else {
        const cardList = StateUtils.findCardList(state, stadiumCard);
        const player = StateUtils.findOwner(state, cardList);
        MOVE_CARDS(store, state, cardList, player.discard, { sourceCard: this });
        return state;
      }
      return state;
    }

    if (WAS_ATTACK_USED(effect, 1, this)) {
      const player = effect.player;
      const dealDamage = new DealDamageEffect(effect, 10);
      dealDamage.target = player.active;
      return store.reduceEffect(state, dealDamage);
    }
    return state;
  }
}