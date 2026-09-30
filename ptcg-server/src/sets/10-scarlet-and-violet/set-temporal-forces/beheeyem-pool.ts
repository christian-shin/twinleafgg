import { PokemonCard, Stage, CardType, PlayerType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class BeheeyemTEFPool extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom: string = 'Elgyem';
  public cardType: CardType[] = [P];
  public hp: number = 100;
  public weakness = [{ type: D }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C];

  public attacks = [{
    name: 'Cosmic Beatdown',
    cost: [P],
    damage: 20,
    damageCalculation: 'x',
    text: 'This attack does 20 damage for each of your Pokémon in play.'
  }];

  public regulationMark = 'H';
  public set: string = 'TEF';
  public setNumber: string = '74';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Beheeyem';
  public fullName: string = 'Beheeyem TEF';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Cosmic Beatdown
    if (WAS_ATTACK_USED(effect, 0, this)) {
      let inPlay = 0;
      effect.player.forEachPokemon(PlayerType.BOTTOM_PLAYER, () => {
        inPlay++;
      });
      effect.damage = 20 * inPlay;
    }
    return state;
  }
}
