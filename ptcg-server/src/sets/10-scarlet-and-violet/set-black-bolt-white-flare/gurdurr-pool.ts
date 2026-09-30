import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { DISCARD_TOP_X_OF_OPPONENTS_DECK, WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class GurdurrBLKPool extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom: string = 'Timburr';
  public cardType: CardType[] = [F];
  public hp: number = 100;
  public weakness = [{ type: P }];
  public resistance = [];
  public retreat = [C, C, C];

  public attacks = [{
    name: 'Low Kick',
    cost: [F],
    damage: 30,
    text: ''
  }, {
    name: 'Hammer Arm',
    cost: [F, C, C],
    damage: 60,
    text: 'Discard the top card of your opponent\'s deck.'
  }];

  public regulationMark = 'I';
  public set: string = 'BLK';
  public setNumber: string = '48';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Gurdurr';
  public fullName: string = 'Gurdurr BLK';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Hammer Arm
    if (WAS_ATTACK_USED(effect, 1, this)) {
      DISCARD_TOP_X_OF_OPPONENTS_DECK(store, state, effect.player, 1, this, effect);
    }
    return state;
  }
}
