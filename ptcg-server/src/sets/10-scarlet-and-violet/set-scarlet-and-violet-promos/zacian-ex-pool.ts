import { PokemonCard, Stage, CardType, CardTag, EnergyType, SlotType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import {
  ATTACH_UP_TO_X_ENERGY_FROM_DECK_TO_Y_OF_YOUR_POKEMON, THIS_POKEMON_CANNOT_USE_THIS_ATTACK_NEXT_TURN, WAS_ATTACK_USED,
} from '../../../game/store/prefabs/prefabs';

export class ZacianexSVPPool extends PokemonCard {
  protected _tags = [CardTag.POKEMON_ex];
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [M];
  public hp: number = 220;
  public weakness = [{ type: R }];
  public resistance = [{ type: G, value: -30 }];
  public retreat = [C, C];

  public attacks = [{
    name: 'Steel Armament',
    cost: [C],
    damage: 20,
    text: 'Search your deck for a Basic [M] Energy card and attach it to this Pokémon. Then, shuffle your deck.'
  }, {
    name: 'Slashing Strike',
    cost: [M, M, C],
    damage: 210,
    text: 'During your next turn, this Pokémon can\'t use Slashing Strike.'
  }];

  public regulationMark = 'H';
  public set: string = 'SVP';
  public setNumber: string = '198';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Zacian ex';
  public fullName: string = 'Zacian ex SVP';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Steel Armament
    if (WAS_ATTACK_USED(effect, 0, this)) {
      return ATTACH_UP_TO_X_ENERGY_FROM_DECK_TO_Y_OF_YOUR_POKEMON(store, state, effect.player, 1, 1, {
        destinationSlots: [SlotType.ACTIVE],
        energyFilter: { energyType: EnergyType.BASIC, name: 'Metal Energy' },
      });
    }

    // Slashing Strike
    if (WAS_ATTACK_USED(effect, 1, this)) {
      THIS_POKEMON_CANNOT_USE_THIS_ATTACK_NEXT_TURN(effect.player, this.attacks[1]);
    }
    return state;
  }
}
