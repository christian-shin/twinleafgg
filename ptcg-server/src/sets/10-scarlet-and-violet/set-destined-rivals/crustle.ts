import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, CardTag } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { GamePhase, State } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';
import { PowerType, StateUtils } from '../../../game';
import {
  PutDamageEffect, ignoresDefenderEffects,
} from '../../../game/store/effects/attack-effects';
import { PowerEffect } from '../../../game/store/effects/game-effects';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class Crustle extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom = 'Dwebble';
  public cardType: CardType[] = [G];
  public hp: number = 150;
  public weakness = [{ type: R }];
  public retreat = [C, C, C];

  public powers = [
    {
      name: 'Mysterious Stone House',
      useWhenInPlay: false,
      powerType: PowerType.ABILITY,
      text: "Prevent all damage done to this Pokémon by attacks from your opponent's Pokémon ex.",
    },
  ];

  public attacks = [
    {
      name: 'Great Scissors',
      cost: [G, C, C],
      damage: 120,
      shredAttack: true,
      text: "This attack's damage isn't affected by any effects on your opponent's Active Pokémon.",
    },
  ];

  public set: string = 'DRI';
  public regulationMark = 'I';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '12';
  public name: string = 'Crustle';
  public fullName: string = 'Crustle DRI';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Mysterious Stone House
    if (effect instanceof PutDamageEffect && !ignoresDefenderEffects(effect) && effect.target.cards.includes(this)) {
      const pokemonCard = effect.target.getPokemonCard();
      const sourceCard = effect.source.getPokemonCard();

      // Card is not active, or damage source is unknown
      if (pokemonCard !== this || sourceCard === undefined) {
        return state;
      }

      // Do not ignore self-damage from Pokemon-Ex
      const player = StateUtils.findOwner(state, effect.target);
      const opponent = StateUtils.findOwner(state, effect.source);
      if (player === opponent) {
        return state;
      }

      // It's not an attack
      if (state.phase !== GamePhase.ATTACK) {
        return state;
      }

      if (sourceCard.hasTag(CardTag.POKEMON_ex)) {
        // Try to reduce PowerEffect, to check if something is blocking our ability
        try {
          const powerEffect = new PowerEffect(player, this.powers[0], this);
          store.reduceEffect(state, powerEffect);
        } catch {
          return state;
        }

        effect.preventDefault = true;
      }
    }

    // Great Scissors
    if (WAS_ATTACK_USED(effect, 0, this)) {
      // Shred: effects on the Defending Pokémon don't change the damage; Weakness, Resistance and
      // effects on the attacker still apply.
      effect.ignoreDefenderEffects = true;
      return state;
    }

    return state;
  }
}
