import { PokemonCard, Stage, CardType, CardTag, StoreLike, State } from '../../../game';
import { SuperType } from '../../../game/store/card/card-types';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { THIS_POKEMON_RETALIATES_ON_DAMAGE_DURING_OPPONENTS_NEXT_TURN } from '../../../game/store/prefabs/effect-of-attack-prefabs';
import { DISCARD_X_ENERGY_FROM_THIS_POKEMON } from '../../../game/store/prefabs/costs';

// Ref: set-paradox-rift/magby.ts (retaliate with damage counters during opponent's next turn)
export class IronBoulderexTEFPool extends PokemonCard {
  protected _tags = [CardTag.POKEMON_ex, CardTag.FUTURE];
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [F];
  public hp: number = 240;
  public weakness = [{ type: G }];
  public resistance = [];
  public retreat = [C, C, C];

  public attacks = [{
    name: 'Repulsor Axe',
    cost: [F, C],
    damage: 60,
    text: 'During your opponent\'s next turn, if this Pokémon is damaged by an attack (even if it is Knocked Out), put 8 damage counters on the Attacking Pokémon.'
  }, {
    name: 'Power Stomp',
    cost: [F, F, C],
    damage: 200,
    text: 'Discard 2 Energy from this Pokémon.'
  }];

  public regulationMark = 'H';
  public set: string = 'TEF';
  public setNumber: string = '99';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Iron Boulder ex';
  public fullName: string = 'Iron Boulder ex TEF';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Repulsor Axe
    if (WAS_ATTACK_USED(effect, 0, this)) {
      return THIS_POKEMON_RETALIATES_ON_DAMAGE_DURING_OPPONENTS_NEXT_TURN(store, state, effect, this, { damage: 80 });
    }

    // Power Stomp
    if (WAS_ATTACK_USED(effect, 1, this)) {
      // Ruling 1652: "discard 2 Energy" counts Energy units and never uses more than 2 cards (ChooseEnergyPrompt).
      if (!effect.player.active.cards.some((c) => c.superType === SuperType.ENERGY)) {
        return state;
      }
      return DISCARD_X_ENERGY_FROM_THIS_POKEMON(store, state, effect, 2);
    }
    return state;
  }
}
