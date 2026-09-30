import { PokemonCard, Stage, CardType, PowerType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { FLIP_A_COIN_IF_HEADS_DEAL_MORE_DAMAGE } from '../../../game/store/prefabs/attack-effects';
import { SURVIVE_ON_TEN_IF_FULL_HP } from '../../../game/store/prefabs/effect-of-attack-prefabs';

// Ref: set-boundaries-crossed/crustle.ts (Sturdy, Stone Edge)
export class CrustleBLKPool extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom: string = 'Dwebble';
  public cardType: CardType[] = [F];
  public hp: number = 150;
  public weakness = [{ type: G }];
  public resistance = [];
  public retreat = [C, C, C];

  public powers = [{
    name: 'Sturdy',
    powerType: PowerType.ABILITY,
    text: 'If this Pokémon has full HP and would be Knocked Out by damage from an attack, it is not Knocked Out, and its remaining HP becomes 10.'
  }];

  public attacks = [{
    name: 'Stone Edge',
    cost: [F, C, C],
    damage: 80,
    damageCalculation: '+',
    text: 'Flip a coin. If heads, this attack does 60 more damage.'
  }];

  public regulationMark = 'I';
  public set: string = 'BLK';
  public setNumber: string = '52';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Crustle';
  public fullName: string = 'Crustle BLK';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Sturdy
    SURVIVE_ON_TEN_IF_FULL_HP(store, state, effect, { source: this, reason: this.powers[0].name });

    // Stone Edge
    if (WAS_ATTACK_USED(effect, 0, this)) {
      return FLIP_A_COIN_IF_HEADS_DEAL_MORE_DAMAGE(store, state, effect, 60);
    }
    return state;
  }
}
