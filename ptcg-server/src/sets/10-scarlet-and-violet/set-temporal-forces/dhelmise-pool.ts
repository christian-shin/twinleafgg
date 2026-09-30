import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { CheckPokemonTypeEffect } from '../../../game/store/effects/check-effects';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class DhelmiseTEFPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [G];
  public hp: number = 130;
  public weakness = [{ type: R }];
  public resistance = [];
  public retreat = [C, C, C];

  public attacks = [{
    name: 'Spinning Attack',
    cost: [C, C],
    damage: 30,
    text: ''
  }, {
    name: 'Steel Anchor',
    cost: [G, G, C],
    damage: 80,
    damageCalculation: '+',
    text: 'If you have any [M] Pokémon on your Bench, this attack does 80 more damage.'
  }];

  public regulationMark = 'H';
  public set: string = 'TEF';
  public setNumber: string = '19';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Dhelmise';
  public fullName: string = 'Dhelmise TEF';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Steel Anchor
    if (WAS_ATTACK_USED(effect, 1, this)) {
      const hasMetalOnBench = effect.player.bench.some(b => {
        if (b.cards.length === 0 || b.getPokemonCard() === undefined) {
          return false;
        }
        const checkType = new CheckPokemonTypeEffect(b);
        store.reduceEffect(state, checkType);
        return checkType.cardTypes.includes(CardType.METAL);
      });
      if (hasMetalOnBench) {
        effect.damage += 80;
      }
    }
    return state;
  }
}
