import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, CardTag } from '../../../game/store/card/card-types';
import { StoreLike, State, StateUtils, PowerType } from '../../../game';
import { AttackEffect, PowerEffect } from '../../../game/store/effects/game-effects';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class WalkingWakeex extends PokemonCard {
  protected _tags = [CardTag.POKEMON_ex, CardTag.ANCIENT];

  public regulationMark = 'H';

  public stage: Stage = Stage.BASIC;

  public cardType: CardType[] = [CardType.WATER];

  public hp: number = 220;

  public weakness = [{ type: CardType.LIGHTNING }];

  public retreat = [CardType.COLORLESS];

  public powers = [
    {
      name: 'Azure Wave',
      powerType: PowerType.ABILITY,
      text: "Damage from attacks used by this Pokémon isn't affected by any effects on your opponent's Active Pokémon.",
    },
  ];

  public attacks = [
    {
      name: 'Cathartic Roar',
      cost: [CardType.WATER, CardType.COLORLESS, CardType.COLORLESS],
      damage: 120,
      text: "If your opponent's Active Pokémon is affected by a Special Condition, this attack does 120 more damage.",
    },
  ];

  public set: string = 'TEF';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '50';

  public name: string = 'Walking Wake ex';

  public fullName: string = 'Walking Wake ex TEF';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof AttackEffect) {
      const player = effect.player;

      const targetCard = player.active.getPokemonCard();
      if (targetCard && targetCard.name == 'Walking Wake ex') {
        // Try to reduce PowerEffect, to check if something is blocking our ability
        try {
          const stub = new PowerEffect(
            player,
            {
              name: 'test',
              powerType: PowerType.ABILITY,
              text: '',
            },
            this,
          );
          store.reduceEffect(state, stub);
        } catch {
          return state;
        }

        // Kept as the serialized marker of the attack (no longer read by the damage path).
        effect.attack.shredAttack = true;
        // Damage from attacks used by this Pokémon isn't affected by any effects on the Defending
        // Pokémon: Weakness, Resistance and effects on the attacker still apply.
        effect.ignoreDefenderEffects = true;
      }
    }

    if (WAS_ATTACK_USED(effect, 0, this)) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);
      if (opponent.active.specialConditions.length > 0) {
        effect.damage += 120;
      }
      return state;
    }
    return state;
  }
}
