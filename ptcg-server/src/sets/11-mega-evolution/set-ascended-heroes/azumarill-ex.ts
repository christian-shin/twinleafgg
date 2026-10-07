import {
  PokemonCard,
  Stage,
  CardTag,
  CardType,
  PowerType,
  StoreLike,
  State,
  MoveEnergyPrompt,
  GameMessage,
  PlayerType,
  SlotType,
  SuperType,
  StateUtils,
  GameError,
  CardTarget,
} from '../../../game';
import { CheckProvidedEnergyEffect } from '../../../game/store/effects/check-effects';
import { Effect } from '../../../game/store/effects/effect';
import {WAS_POWER_USED, ABILITY_USED, WAS_ATTACK_USED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

export class Azumarillex extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom: string = 'Marill';
  protected _tags = [CardTag.POKEMON_ex];
  public cardType: CardType[] = [P];
  public hp: number = 270;
  public weakness = [{ type: M }];
  public resistance = [];
  public retreat = [C, C];

  public powers = [
    {
      name: 'Bubble Gathering',
      useWhenInPlay: true,
      powerType: PowerType.ABILITY,
      text: 'As often as you like during your turn, you may use this Ability. Move an Energy from 1 of your other Pokémon to this Pokémon.',
    },
  ];

  public attacks = [
    {
      name: 'Energy Balloon',
      cost: [C, C, C],
      damage: 60,
      damageCalculation: '+',
      text: 'This attack does 40 more damage for each [P] Energy attached to this Pokemon.',
    },
  ];

  public regulationMark: string = 'I';
  public set: string = 'ASC';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '84';
  public name: string = 'Azumarill ex';
  public fullName: string = 'Azumarill ex MC';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Bubble Bundle ability
    if (WAS_POWER_USED(effect, 0, this)) {
      const player = effect.player;

      // Move from 1 of the other Pokémon to this Pokémon only
      const blockedFrom: CardTarget[] = [];
      const blockedTo: CardTarget[] = [];
      let energyOnOthers = false;
      player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList, card, target) => {
        if (card === this) {
          blockedFrom.push(target);
        } else {
          blockedTo.push(target);
          if (cardList.cards.some(c => c.superType === SuperType.ENERGY)) {
            energyOnOthers = true;
          }
        }
      });

      // An Ability can't be used for no effect (ruling 12): no Energy on the other Pokémon
      if (!energyOnOthers) {
        throw new GameError(GameMessage.CANNOT_USE_POWER);
      }

      return store.prompt(
        state,
        new MoveEnergyPrompt(
          player.id,
          GameMessage.MOVE_ENERGY_CARDS,
          PlayerType.BOTTOM_PLAYER,
          [SlotType.ACTIVE, SlotType.BENCH],
          { superType: SuperType.ENERGY },
          { allowCancel: true, min: 0, max: 1, blockedFrom, blockedTo },
        ),
        (transfers) => {
          transfers = transfers || [];
          if (transfers.length > 0) {
            for (const transfer of transfers) {
              if (
                StateUtils.getTarget(state, player, transfer.to) !==
                StateUtils.findCardList(state, this)
              ) {
                throw new GameError(GameMessage.INVALID_TARGET);
              }
              const source = StateUtils.getTarget(state, player, transfer.from);
              const target = StateUtils.getTarget(state, player, transfer.to);
              MOVE_CARDS(store, state, source, target, { cards: [transfer.card], sourceCard: this });
            }
          }
          ABILITY_USED(player, this);
        },
      );
    }

    // Energy Balloon attack
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const player = effect.player;
      let psychicEnergyCount = 0;

      const checkProvidedEnergyEffect = new CheckProvidedEnergyEffect(player, player.active);
      store.reduceEffect(state, checkProvidedEnergyEffect);
      checkProvidedEnergyEffect.energyMap.forEach((energy) => {
        if (energy.provides.includes(CardType.PSYCHIC) || energy.provides.includes(CardType.ANY)) {
          psychicEnergyCount++;
        }
      });

      effect.damage += 40 * psychicEnergyCount;
    }

    return state;
  }
}
