import { PokemonCard, Stage, CardType, EnergyType, StoreLike, State, StateUtils, SuperType } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { SEARCH_DECK_FOR_CARDS_TO_HAND, WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class TealMaskOgerponTWMPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [G];
  public hp: number = 110;
  public weakness = [{ type: R }];
  public resistance = [];
  public retreat = [C];

  public attacks = [{
    name: 'Mountain Stroll',
    cost: [C],
    damage: 0,
    text: 'Search your deck for up to 2 Basic Energy cards, reveal them, and put them into your hand. Then, shuffle your deck.'
  }, {
    name: 'Ogre Comeback',
    cost: [G, C],
    damage: 20,
    damageCalculation: '+',
    text: 'This attack does 20 more damage for each of your opponent\'s Benched Pokémon.'
  }];

  public regulationMark = 'H';
  public set: string = 'TWM';
  public setNumber: string = '24';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Teal Mask Ogerpon';
  public fullName: string = 'Teal Mask Ogerpon TWM';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Mountain Stroll
    if (WAS_ATTACK_USED(effect, 0, this)) {
      SEARCH_DECK_FOR_CARDS_TO_HAND(store, state, effect.player, this,
        { superType: SuperType.ENERGY, energyType: EnergyType.BASIC } as any,
        { min: 0, max: 2, allowCancel: false }, effect);
    }

    // Ogre Comeback
    if (WAS_ATTACK_USED(effect, 1, this)) {
      const opponent = StateUtils.getOpponent(state, effect.player);
      const benched = opponent.bench.filter(b => b.cards.length > 0).length;
      effect.damage += 20 * benched;
    }
    return state;
  }
}
