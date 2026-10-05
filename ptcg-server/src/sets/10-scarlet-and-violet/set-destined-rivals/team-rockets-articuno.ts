import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, CardTag, SuperType } from '../../../game/store/card/card-types';
import { StoreLike, State, PowerType, StateUtils } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED, IS_ABILITY_BLOCKED, IS_ATTACK_EFFECT_FROM_OPPONENTS_POKEMON } from '../../../game/store/prefabs/prefabs';
import { AbstractAttackEffect, ApplyWeaknessEffect, DealDamageEffect, PutDamageEffect } from '../../../game/store/effects/attack-effects';

export class TeamRocketsArticuno extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  protected _tags = [CardTag.TEAM_ROCKET];
  public cardType: CardType[] = [W];
  public hp: number = 120;
  public weakness = [{ type: L }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C];

  public powers = [
    {
      name: 'Repelling Veil',
      powerType: PowerType.ABILITY,
      text: "Prevent all effects of attacks used by your opponent's Pokémon done to your Basic Team Rocket's Pokémon. (Existing effects are not removed. Damage is not an effect.)",
    },
  ];

  public attacks = [
    {
      name: 'Dark Frost',
      cost: [W, C, C],
      damage: 60,
      damageCalculation: '+',
      text: "If this Pokémon has any Team Rocket's Energy attached, this attack does 60 more damage.",
    },
  ];

  public regulationMark = 'I';
  public set: string = 'DRI';
  public setNumber: string = '51';
  public cardImage: string = 'assets/cardback.png';
  public name: string = "Team Rocket's Articuno";
  public fullName: string = "Team Rocket's Articuno DRI";

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Repelling Veil
    if (effect instanceof AbstractAttackEffect) {
      const targetPokemon = effect.target.getPokemonCard();
      if (
        targetPokemon === undefined ||
        targetPokemon.stage !== Stage.BASIC ||
        !targetPokemon.hasTag(CardTag.TEAM_ROCKET)
      ) {
        return state;
      }

      const owner = StateUtils.findOwner(state, effect.target);
      if (!StateUtils.isPokemonInPlay(owner, this)) {
        return state;
      }

      if (IS_ABILITY_BLOCKED(store, state, owner, this)) {
        return state;
      }

      if (!IS_ATTACK_EFFECT_FROM_OPPONENTS_POKEMON(state, effect)) {
        return state;
      }

      if (effect.source.getPokemonCard()) {
        // Weakness, Resistance and damage are not effects
        if (effect instanceof ApplyWeaknessEffect) {
          return state;
        }
        if (effect instanceof PutDamageEffect) {
          return state;
        }
        if (effect instanceof DealDamageEffect) {
          return state;
        }
        effect.preventDefault = true;
      }
      return state;
    }

    // Dark Frost
    if (WAS_ATTACK_USED(effect, 0, this)) {
      if (
        effect.player.active.cards.some(
          (c) => c.superType === SuperType.ENERGY && c.name === "Team Rocket's Energy",
        )
      ) {
        effect.damage += 60;
      }
    }

    return state;
  }
}
