import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { YOUR_OPPPONENTS_ACTIVE_POKEMON_IS_NOW_POISIONED } from '../../../game/store/prefabs/attack-effects';

export class ShroodleMEGPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [D];
  public hp: number = 60;
  public weakness = [{ type: F }];
  public resistance = [];
  public retreat = [C];

  public attacks = [{
    name: 'Poison Jab',
    cost: [D, C],
    damage: 20,
    text: 'Your opponent\'s Active Pokémon is now Poisoned.'
  }];

  public regulationMark = 'I';
  public set: string = 'MEG';
  public setNumber: string = '91';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Shroodle';
  public fullName: string = 'Shroodle MEG';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Poison Jab
    if (WAS_ATTACK_USED(effect, 0, this)) {
      YOUR_OPPPONENTS_ACTIVE_POKEMON_IS_NOW_POISIONED(store, state, effect);
    }
    return state;
  }
}
