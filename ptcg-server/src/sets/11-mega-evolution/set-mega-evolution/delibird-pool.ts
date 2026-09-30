import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { SEARCH_DECK_FOR_CARDS_TO_HAND, WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class DelibirdMEGPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [C];
  public hp: number = 90;
  public weakness = [{ type: L }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C];

  public attacks = [{
    name: 'Quick Gift',
    cost: [C],
    damage: 0,
    canUseOnFirstTurn: true,
    text: 'If you go first, you can use this attack during your first turn. Search your deck for a card and put it into your hand. Then, shuffle your deck.'
  }, {
    name: 'Gentle Slap',
    cost: [C, C],
    damage: 30,
    text: ''
  }];

  public regulationMark = 'I';
  public set: string = 'MEG';
  public setNumber: string = '105';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Delibird';
  public fullName: string = 'Delibird MEG';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Quick Gift
    if (WAS_ATTACK_USED(effect, 0, this)) {
      SEARCH_DECK_FOR_CARDS_TO_HAND(store, state, effect.player, this, {}, { min: 1, max: 1, allowCancel: false }, effect);
    }
    return state;
  }
}
