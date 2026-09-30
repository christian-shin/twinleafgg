import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { MULTIPLE_COIN_FLIPS_PROMPT, WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class MankeySSPPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [F];
  public hp: number = 60;
  public weakness = [{ type: P }];
  public resistance = [];
  public retreat = [C];

  public attacks = [{
    name: 'Dual Chop',
    cost: [C],
    damage: 10,
    damageCalculation: 'x',
    text: 'Flip 2 coins. This attack does 10 damage for each heads.'
  }];

  public regulationMark = 'H';
  public set: string = 'SSP';
  public setNumber: string = '98';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Mankey';
  public fullName: string = 'Mankey SSP';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Dual Chop
    if (WAS_ATTACK_USED(effect, 0, this)) {
      return MULTIPLE_COIN_FLIPS_PROMPT(store, state, effect.player, 2, results => {
        effect.damage = 10 * results.filter(r => r).length;
      });
    }
    return state;
  }
}
