import {
  PokemonCard, Stage, CardType, StoreLike, State, CardTarget, ChoosePokemonPrompt,
  GameMessage, PlayerType, SlotType,
} from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { MoveCountersAttackEffect } from '../../../game/store/effects/attack-effects';
import { MoveDamageCountersEffect } from '../../../game/store/effects/game-effects';
import { WAS_ATTACK_USED, AFTER_ATTACK } from '../../../game/store/prefabs/prefabs';
import { YOUR_OPPPONENTS_ACTIVE_POKEMON_IS_NOW_CONFUSED } from '../../../game/store/prefabs/attack-effects';

// Ref: prefabs.ts MOVE_DAMAGE_FROM_YOUR_BENCH_TO_OPPONENTS_ACTIVE (same move, any opposing target)
export class CofagrigusWHTPool extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom: string = 'Yamask';
  public cardType: CardType[] = [P];
  public hp: number = 120;
  public weakness = [{ type: D }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C, C];

  public attacks = [{
    name: 'Extended Damagriiigus',
    cost: [P, C],
    damage: 0,
    text: 'Move all damage counters from 1 of your Benched Pokémon to 1 of your opponent\'s Pokémon.'
  }, {
    name: 'Perplex',
    cost: [P, C, C],
    damage: 60,
    text: 'Your opponent\'s Active Pokémon is now Confused.'
  }];

  public regulationMark = 'I';
  public set: string = 'WHT';
  public setNumber: string = '40';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Cofagrigus';
  public fullName: string = 'Cofagrigus WHT';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Extended Damagriiigus
    if (AFTER_ATTACK(effect, 0, this)) {
      const player = effect.player;
      const hasDamagedBench = player.bench.some(b => b.cards.length > 0 && b.damage > 0);
      if (!hasDamagedBench) {
        return state;
      }

      const blocked: CardTarget[] = [];
      player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList, card, target) => {
        if (cardList === player.active || cardList.damage === 0) {
          blocked.push(target);
        }
      });

      return store.prompt(state, new ChoosePokemonPrompt(
        player.id,
        GameMessage.CHOOSE_POKEMON,
        PlayerType.BOTTOM_PLAYER,
        [SlotType.BENCH],
        { min: 1, max: 1, allowCancel: false, blocked }
      ), selected => {
        if (!selected || selected.length === 0) {
          return;
        }
        const source = selected[0];

        return store.prompt(state, new ChoosePokemonPrompt(
          player.id,
          GameMessage.CHOOSE_POKEMON_TO_DAMAGE,
          PlayerType.TOP_PLAYER,
          [SlotType.ACTIVE, SlotType.BENCH],
          { min: 1, max: 1, allowCancel: false }
        ), targets => {
          if (!targets || targets.length === 0) {
            return;
          }
          const damageToMove = source.damage;
          if (damageToMove <= 0) {
            return;
          }

          // "Damage counters can't be moved" cancels the whole move.
          const moveCheck = new MoveDamageCountersEffect(player);
          state = store.reduceEffect(state, moveCheck);
          if (moveCheck.preventDefault) {
            return;
          }

          const moveEffect = new MoveCountersAttackEffect(effect.attackEffect, source, targets[0], damageToMove);
          state = store.reduceEffect(state, moveEffect);

          moveEffect.source.damage -= moveEffect.damage;
          if (moveEffect.source.damage < 0) {
            moveEffect.source.damage = 0;
          }
          if (!moveEffect.preventDefault) {
            moveEffect.target.damage += moveEffect.damage;
          }
        });
      });
    }

    // Perplex
    if (WAS_ATTACK_USED(effect, 1, this)) {
      YOUR_OPPPONENTS_ACTIVE_POKEMON_IS_NOW_CONFUSED(store, state, effect);
    }
    return state;
  }
}
