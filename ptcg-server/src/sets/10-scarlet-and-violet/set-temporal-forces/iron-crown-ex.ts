import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, CardTag } from '../../../game/store/card/card-types';
import {
  StoreLike,
  State,
  PowerType,
  ChoosePokemonPrompt,
  GameMessage,
  PlayerType,
  SlotType,
  StateUtils,
  GamePhase,
} from '../../../game';
import { Effect } from '../../../game/store/effects/effect';

import { DealDamageEffect } from '../../../game/store/effects/attack-effects';
import { IS_ABILITY_BLOCKED, WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class IronCrownex extends PokemonCard {
  protected _tags = [CardTag.POKEMON_ex, CardTag.FUTURE];

  public regulationMark = 'H';

  public stage: Stage = Stage.BASIC;

  public cardType: CardType[] = [CardType.PSYCHIC];

  public hp: number = 220;

  public weakness = [{ type: CardType.DARK }];

  public resistance = [{ type: CardType.FIGHTING, value: -30 }];

  public retreat = [CardType.COLORLESS, CardType.COLORLESS];

  public powers = [
    {
      name: 'Cobalt Command',
      powerType: PowerType.ABILITY,
      exemptFromInitialize: true,
      text: "Your Future Pokémon's attacks, except any Iron Crown ex, do 20 more damage to your opponent's Active Pokémon (before applying Weakness and Resistance).",
    },
  ];

  public attacks = [
    {
      name: 'Twin Shotels',
      cost: [CardType.PSYCHIC, CardType.COLORLESS, CardType.COLORLESS],
      damage: 0,
      text: "This attack does 50 damage to 2 of your opponent's Pokémon. This attack's damage isn't affected by Weakness or Resistance, or by any effects on those Pokémon.",
    },
  ];

  public set: string = 'TEF';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '81';

  public name: string = 'Iron Crown ex';

  public fullName: string = 'Iron Crown ex TEF';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);

      // 2 of your opponent's Pokémon (all of them when the opponent has fewer)
      const max = Math.min(2, 1 + opponent.bench.filter(b => b.cards.length > 0).length);
      state = store.prompt(
        state,
        new ChoosePokemonPrompt(
          player.id,
          GameMessage.CHOOSE_POKEMON_TO_DAMAGE,
          PlayerType.TOP_PLAYER,
          [SlotType.ACTIVE, SlotType.BENCH],
          { min: max, max: max, allowCancel: false },
        ),
        (selected) => {
          const targets = selected || [];

          if (targets == null) {
            return state;
          }

          // Not affected by Weakness or Resistance, or by any effects on those Pokémon (rulings
          // 1490, 1629, 1875); effects on the attacker (Maximum Belt on the Active ex, ...) apply.
          effect.ignoreDefenderEffects = true;
          effect.ignoreWeakness = true;
          effect.ignoreResistance = true;

          targets.forEach((target) => {
            const dealDamage = new DealDamageEffect(effect, 50);
            dealDamage.target = target;
            state = store.reduceEffect(state, dealDamage);
          });
        },
      );
    }

    if (effect instanceof DealDamageEffect && StateUtils.isPokemonInPlay(effect.player, this)) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, effect.player);
      const source = effect.source.getPokemonCard() as PokemonCard;

      if (
        state.phase === GamePhase.ATTACK &&
        source.hasTag(CardTag.FUTURE) &&
        source.name !== 'Iron Crown ex' &&
        effect.target === opponent.active &&
        effect.damage > 0 &&
        !IS_ABILITY_BLOCKED(store, state, player, this)
      ) {
        effect.damage += 20;
      }
    }
    return state;
  }
}
