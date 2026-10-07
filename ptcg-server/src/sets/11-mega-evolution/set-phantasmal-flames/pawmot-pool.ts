import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { CONFIRMATION_PROMPT, THIS_POKEMON_DOES_DAMAGE_TO_ITSELF, AFTER_ATTACK } from '../../../game/store/prefabs/prefabs';
import { YOUR_OPPPONENTS_ACTIVE_POKEMON_IS_NOW_PARALYZED } from '../../../game/store/prefabs/attack-effects';

// Ref: set-ancient-origins/golurk.ts (optional self-damage via CONFIRMATION_PROMPT)
export class PawmotPFLPool extends PokemonCard {
  public stage: Stage = Stage.STAGE_2;
  public evolvesFrom: string = 'Pawmo';
  public cardType: CardType[] = [L];
  public hp: number = 140;
  public weakness = [{ type: F }];
  public resistance = [];
  public retreat = [C];

  public attacks = [{
    name: 'Voltaic Fist',
    cost: [L, L],
    damage: 130,
    text: 'You may have this Pokémon also do 60 damage to itself and make your opponent\'s Active Pokémon Paralyzed.'
  }];

  public regulationMark = 'I';
  public set: string = 'PFL';
  public setNumber: string = '34';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Pawmot';
  public fullName: string = 'Pawmot PFL';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Voltaic Fist
    if (AFTER_ATTACK(effect, 0, this)) {
      return CONFIRMATION_PROMPT(store, state, effect.player, result => {
        if (result) {
          THIS_POKEMON_DOES_DAMAGE_TO_ITSELF(store, state, effect.attackEffect, 60);
          YOUR_OPPPONENTS_ACTIVE_POKEMON_IS_NOW_PARALYZED(store, state, effect.attackEffect);
        }
      });
    }
    return state;
  }
}
