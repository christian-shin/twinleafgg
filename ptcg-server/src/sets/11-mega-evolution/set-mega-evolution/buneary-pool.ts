import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { DEFENDING_POKEMON_DOES_LESS_DAMAGE } from '../../../game/store/prefabs/effect-of-attack-prefabs';

export class BunearyMEGPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [C];
  public hp: number = 70;
  public weakness = [{ type: F }];
  public resistance = [];
  public retreat = [C];

  public attacks = [{
    name: 'Charm',
    cost: [C],
    damage: 0,
    text: 'During your opponent\'s next turn, attacks used by the Defending Pokémon do 20 less damage (before applying Weakness and Resistance).'
  }, {
    name: 'Skip',
    cost: [C],
    damage: 10,
    text: ''
  }];

  public regulationMark = 'I';
  public set: string = 'MEG';
  public setNumber: string = '107';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Buneary';
  public fullName: string = 'Buneary MEG';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Charm
    if (WAS_ATTACK_USED(effect, 0, this)) {
      return DEFENDING_POKEMON_DOES_LESS_DAMAGE(store, state, effect, this, 20);
    }
    return state;
  }
}
