import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { THIS_POKEMON_RETALIATES_ON_DAMAGE_DURING_OPPONENTS_NEXT_TURN } from '../../../game/store/prefabs/effect-of-attack-prefabs';
import { DISCARD_UP_TO_X_ENERGY_FROM_THIS_POKEMON } from '../../../game/store/prefabs/costs';

// Ref: set-paradox-rift/magby.ts (retaliate with damage counters during opponent's next turn)
export class BouffalantSSPPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [C];
  public hp: number = 130;
  public weakness = [{ type: F }];
  public resistance = [];
  public retreat = [C, C];

  public attacks = [{
    name: 'Ready to Ram',
    cost: [C, C],
    damage: 40,
    text: 'During your opponent\'s next turn, if this Pokémon is damaged by an attack (even if this Pokémon is Knocked Out), put 6 damage counters on the Attacking Pokémon.'
  }, {
    name: 'Smashing Headbutt',
    cost: [C, C, C, C],
    damage: 150,
    text: 'Discard 2 Energy from this Pokémon.'
  }];

  public regulationMark = 'H';
  public set: string = 'SSP';
  public setNumber: string = '151';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Bouffalant';
  public fullName: string = 'Bouffalant SSP';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Ready to Ram
    if (WAS_ATTACK_USED(effect, 0, this)) {
      return THIS_POKEMON_RETALIATES_ON_DAMAGE_DURING_OPPONENTS_NEXT_TURN(store, state, effect, this, { damage: 60 });
    }

    // Smashing Headbutt
    if (WAS_ATTACK_USED(effect, 1, this)) {
      return DISCARD_UP_TO_X_ENERGY_FROM_THIS_POKEMON(store, state, effect, 2, {}, 2);
    }
    return state;
  }
}
