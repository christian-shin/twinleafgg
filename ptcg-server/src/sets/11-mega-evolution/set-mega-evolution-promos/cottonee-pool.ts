import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { DRAW_CARDS, WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class CottoneeMEPPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [P];
  public hp: number = 60;
  public weakness = [{ type: M }];
  public resistance = [];
  public retreat = [C];

  public attacks = [{
    name: 'Collect',
    cost: [C],
    damage: 0,
    text: 'Draw a card.'
  }];

  public regulationMark = 'I';
  public set: string = 'MEP';
  public setNumber: string = '18';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Cottonee';
  public fullName: string = 'Cottonee MEP';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Collect
    if (WAS_ATTACK_USED(effect, 0, this)) {
      DRAW_CARDS(store, state, effect.player, 1);
    }
    return state;
  }
}
