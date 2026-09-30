import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { BLOCK_RETREAT } from '../../../game/store/prefabs/effect-of-attack-prefabs';

export class DhelmiseJTGPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [P];
  public hp: number = 130;
  public weakness = [{ type: D }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C, C, C];

  public attacks = [{
    name: 'Bind Down',
    cost: [P, C, C],
    damage: 60,
    text: 'During your opponent\'s next turn, the Defending Pokémon can\'t retreat.'
  }, {
    name: 'Anchor Smash',
    cost: [P, P, C, C],
    damage: 130,
    text: ''
  }];

  public regulationMark = 'H';
  public set: string = 'JTG';
  public setNumber: string = '70';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Dhelmise';
  public fullName: string = 'Dhelmise JTG';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Bind Down
    if (WAS_ATTACK_USED(effect, 0, this)) {
      return BLOCK_RETREAT(store, state, effect, this);
    }
    return state;
  }
}
