import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { FLIP_A_COIN_IF_HEADS_DEAL_MORE_DAMAGE } from '../../../game/store/prefabs/attack-effects';

export class BronzorSSPPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [M];
  public hp: number = 60;
  public weakness = [{ type: R }];
  public resistance = [{ type: G, value: -30 }];
  public retreat = [C];

  public attacks = [{
    name: 'Shield Attack',
    cost: [M, C],
    damage: 20,
    damageCalculation: '+',
    text: 'Flip a coin. If heads, this attack does 20 more damage.'
  }];

  public regulationMark = 'H';
  public set: string = 'SSP';
  public setNumber: string = '126';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Bronzor';
  public fullName: string = 'Bronzor SSP';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Shield Attack
    if (WAS_ATTACK_USED(effect, 0, this)) {
      return FLIP_A_COIN_IF_HEADS_DEAL_MORE_DAMAGE(store, state, effect, 20);
    }
    return state;
  }
}
