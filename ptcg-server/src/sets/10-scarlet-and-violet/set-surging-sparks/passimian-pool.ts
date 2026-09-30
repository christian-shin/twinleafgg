import { PokemonCard, Stage, CardType, PlayerType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class PassimianSSPPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [F];
  public hp: number = 110;
  public weakness = [{ type: P }];
  public resistance = [];
  public retreat = [C];

  public attacks = [{
    name: 'Coordinated Throwing',
    cost: [F, C],
    damage: 20,
    damageCalculation: 'x',
    text: 'This attack does 20 damage for each of your Basic Pokémon in play.'
  }];

  public regulationMark = 'H';
  public set: string = 'SSP';
  public setNumber: string = '111';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Passimian';
  public fullName: string = 'Passimian SSP';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Coordinated Throwing
    if (WAS_ATTACK_USED(effect, 0, this)) {
      let basics = 0;
      effect.player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList, card) => {
        if (card.stage === Stage.BASIC) {
          basics++;
        }
      });
      effect.damage = 20 * basics;
    }
    return state;
  }
}
