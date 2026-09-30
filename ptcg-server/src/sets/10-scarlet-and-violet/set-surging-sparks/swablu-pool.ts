import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { YOUR_OPPPONENTS_ACTIVE_POKEMON_IS_NOW_CONFUSED } from '../../../game/store/prefabs/attack-effects';

export class SwabluSSPPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [C];
  public hp: number = 50;
  public weakness = [{ type: L }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C];

  public attacks = [{
    name: 'Disarming Voice',
    cost: [C],
    damage: 10,
    text: 'Your opponent\'s Active Pokémon is now Confused.'
  }];

  public regulationMark = 'H';
  public set: string = 'SSP';
  public setNumber: string = '148';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Swablu';
  public fullName: string = 'Swablu SSP';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Disarming Voice
    if (WAS_ATTACK_USED(effect, 0, this)) {
      YOUR_OPPPONENTS_ACTIVE_POKEMON_IS_NOW_CONFUSED(store, state, effect);
    }
    return state;
  }
}
