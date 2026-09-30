import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { THIS_POKEMON_CANNOT_ATTACK_NEXT_TURN, WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class PyroarPREPool extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom: string = 'Litleo';
  public cardType: CardType[] = [R];
  public hp: number = 120;
  public weakness = [{ type: W }];
  public resistance = [];
  public retreat = [C, C];

  public attacks = [{
    name: 'Fire Mane',
    cost: [R, C],
    damage: 50,
    text: ''
  }, {
    name: 'Flame Tackle',
    cost: [R, R, C],
    damage: 160,
    text: 'During your next turn, this Pokémon can\'t attack.'
  }];

  public regulationMark = 'H';
  public set: string = 'PRE';
  public setNumber: string = '16';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Pyroar';
  public fullName: string = 'Pyroar PRE';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Flame Tackle
    if (WAS_ATTACK_USED(effect, 1, this)) {
      THIS_POKEMON_CANNOT_ATTACK_NEXT_TURN(effect.player);
    }
    return state;
  }
}
