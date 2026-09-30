import { PokemonCard, Stage, CardType, StoreLike, State, StateUtils } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { DISCARD_UP_TO_X_ENERGY_FROM_THIS_POKEMON } from '../../../game/store/prefabs/costs';

export class GalarianObstagoonASCPool extends PokemonCard {
  public stage: Stage = Stage.STAGE_2;
  public evolvesFrom: string = 'Galarian Linoone';
  public cardType: CardType[] = [D];
  public hp: number = 170;
  public weakness = [{ type: G }];
  public resistance = [];
  public retreat = [C, C];

  public attacks = [{
    name: 'Scarring Shout',
    cost: [D, C],
    damage: 70,
    damageCalculation: 'x',
    text: 'This attack does 70 damage for each damage counter on your opponent\'s Active Pokémon.'
  }, {
    name: 'Punk Smash',
    cost: [D, C, C],
    damage: 160,
    text: 'Discard an Energy from this Pokémon.'
  }];

  public regulationMark = 'I';
  public set: string = 'ASC';
  public setNumber: string = '132';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Galarian Obstagoon';
  public fullName: string = 'Galarian Obstagoon ASC';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Scarring Shout
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const opponent = StateUtils.getOpponent(state, effect.player);
      effect.damage = 70 * Math.floor(opponent.active.damage / 10);
    }

    // Punk Smash
    if (WAS_ATTACK_USED(effect, 1, this)) {
      return DISCARD_UP_TO_X_ENERGY_FROM_THIS_POKEMON(store, state, effect, 1, {}, 1);
    }

    return state;
  }
}
