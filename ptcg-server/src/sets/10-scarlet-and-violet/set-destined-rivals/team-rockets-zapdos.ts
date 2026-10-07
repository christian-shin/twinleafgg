import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, CardTag, SuperType } from '../../../game/store/card/card-types';
import {
  StoreLike,
  State,
  PlayerType,
  AttachEnergyPrompt,
  GameMessage,
  SlotType,
  StateUtils,
} from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import {CONFIRMATION_PROMPT, WAS_ATTACK_USED, AFTER_ATTACK } from '../../../game/store/prefabs/prefabs';
import { MoveOpponentEnergyEffect } from '../../../game/store/effects/attack-effects';

export class TeamRocketsZapdos extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  protected _tags = [CardTag.TEAM_ROCKET];
  public cardType: CardType[] = [L];
  public hp: number = 120;
  public weakness = [{ type: L }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C];

  public attacks = [
    {
      name: 'Jamming Wave',
      cost: [C, C],
      damage: 30,
      text: "You may move an Energy from your opponent's Active Pokémon to 1 of their Benched Pokémon.",
    },
    {
      name: 'Bad Thunder',
      cost: [L, C, C],
      damage: 60,
      damageCalculation: '+',
      text: 'If this Pokémon has Team Rocket Energy attached, this attack does 60 more damage.',
    },
  ];

  public regulationMark = 'I';
  public set: string = 'DRI';
  public setNumber: string = '70';
  public cardImage: string = 'assets/cardback.png';
  public name: string = "Team Rocket's Zapdos";
  public fullName: string = "Team Rocket's Zapdos DRI";

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Jamming Wave
    if (AFTER_ATTACK(effect, 0, this)) {
      const player = effect.player;
      const opponent = effect.opponent;

      CONFIRMATION_PROMPT(store, state, player, (result) => {
        if (result) {
          if (!opponent.bench.some((b) => b.cards.length > 0)) {
            return state;
          }

          if (!opponent.active.cards.some((c) => c.superType === SuperType.ENERGY)) {
            return state;
          }

          return store.prompt(
            state,
            new AttachEnergyPrompt(
              player.id,
              GameMessage.ATTACH_ENERGY_TO_BENCH,
              opponent.active,
              PlayerType.TOP_PLAYER,
              [SlotType.BENCH],
              { superType: SuperType.ENERGY },
              { allowCancel: false, min: 1, max: 1 },
            ),
            (transfers) => {
              transfers = transfers || [];
              for (const transfer of transfers) {
                const target = StateUtils.getTarget(state, player, transfer.to);
                // An effect of the attack on the Defending Pokémon: Mist Energy and the like prevent it (ruling 1843)
                const moveEffect = new MoveOpponentEnergyEffect(effect.attackEffect, transfer.card, opponent.active, target);
                store.reduceEffect(state, moveEffect);
              }
            },
          );
        }
      });
    }

    // Bad Thunder
    if (WAS_ATTACK_USED(effect, 1, this)) {
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
