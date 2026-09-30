import { PokemonCard, Stage, CardType, StoreLike, State, StateUtils } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { DISCARD_UP_TO_X_ENERGY_FROM_THIS_POKEMON } from '../../../game/store/prefabs/costs';

export class GlalieTWMPool extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom: string = 'Snorunt';
  public cardType: CardType[] = [W];
  public hp: number = 120;
  public weakness = [{ type: M }];
  public resistance = [];
  public retreat = [C, C];

  public attacks = [{
    name: 'Damage Beat',
    cost: [W],
    damage: 20,
    damageCalculation: 'x',
    text: 'This attack does 20 damage for each damage counter on your opponent\'s Active Pokémon.'
  }, {
    name: 'Crazy Headbutt',
    cost: [W, C, C],
    damage: 140,
    text: 'Discard an Energy from this Pokémon.'
  }];

  public regulationMark = 'H';
  public set: string = 'TWM';
  public setNumber: string = '52';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Glalie';
  public fullName: string = 'Glalie TWM';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Damage Beat
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const opponent = StateUtils.getOpponent(state, effect.player);
      effect.damage = 20 * Math.floor(opponent.active.damage / 10);
    }

    // Crazy Headbutt
    if (WAS_ATTACK_USED(effect, 1, this)) {
      return DISCARD_UP_TO_X_ENERGY_FROM_THIS_POKEMON(store, state, effect, 1, {}, 1);
    }
    return state;
  }
}
