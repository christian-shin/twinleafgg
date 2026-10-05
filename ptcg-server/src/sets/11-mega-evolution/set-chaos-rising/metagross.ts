import { CardType, Stage } from '../../../game/store/card/card-types';
import { Effect } from '../../../game/store/effects/effect';
import {
  PokemonCard,
  StoreLike,
  State,
  StateUtils,
  SlotType,
  GameMessage,
  ConfirmPrompt,
} from '../../../game';
import { AttackEffect } from '../../../game/store/effects/game-effects';
import { AFTER_ATTACK, SWITCH_OUT_OPPONENT_ACTIVE_POKEMON, WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { DISCARD_UP_TO_X_TYPE_ENERGY_FROM_YOUR_POKEMON } from '../../../game/store/prefabs/costs';

export class Metagross extends PokemonCard {
  public stage: Stage = Stage.STAGE_2;
  public evolvesFrom = 'Metang';
  public hp: number = 180;
  public cardType: CardType[] = [M];
  public weakness = [{ type: R }];
  public resistance = [{ type: G, value: -30 }];
  public retreat = [C, C, C];

  public attacks = [
    {
      name: 'Bounce Back',
      cost: [M],
      damage: 60,
      text: 'Your opponent switches their Active Pokémon with 1 of their Benched Pokémon.',
    },
    {
      name: 'Metallic Hammer',
      cost: [M, M, M, C],
      damage: 150,
      damageCalculation: '+',
      text: 'You may discard 3 [M] Energy from this Pokémon and have this attack do 150 more damage.',
    },
  ];

  public regulationMark = 'J';
  public set: string = 'CRI';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '61';
  public name: string = 'Metagross';
  public fullName: string = 'Metagross M4';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (AFTER_ATTACK(effect, 0, this)) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);
      const hasBench = opponent.bench.some((b) => b.cards.length > 0);
      if (!hasBench) return state;
      // "Switch out your opponent's Active Pokémon": an effect of the attack on the Defending Pokémon, so
      // Mist Energy and the like prevent it (ruling 1574). "Your opponent chooses the new Active Pokémon."
      return SWITCH_OUT_OPPONENT_ACTIVE_POKEMON(store, state, player, { sourceEffect: effect });
    }
    if (WAS_ATTACK_USED(effect, 1, this) && effect instanceof AttackEffect) {
      const player = effect.player;
      // The choice is always offered, also with fewer than 3 [M] Energy (a copy of this attack by a Pokémon
      // with few or none): it then discards as many as it can (ruling 1822).
      return store.prompt(
        state,
        new ConfirmPrompt(player.id, GameMessage.WANT_TO_DISCARD_ENERGY),
        (confirm) => {
          if (confirm) {
            effect.damage += 150;
            return DISCARD_UP_TO_X_TYPE_ENERGY_FROM_YOUR_POKEMON(
              store,
              state,
              effect,
              3,
              CardType.METAL,
              3,
              [SlotType.ACTIVE],
            );
          }
        },
      );
    }
    return state;
  }
}
