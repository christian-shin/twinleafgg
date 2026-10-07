import {
  AttachEnergyPrompt,
  CardTag,
  CardType,
  GameMessage,
  PlayerType,
  PokemonCard,
  PowerType,
  SlotType,
  Stage,
  State,
  StateUtils,
  StoreLike,
  SuperType,
} from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { KnockOutEffect } from '../../../game/store/effects/game-effects';
import { AfterAttackEffect } from '../../../game/store/effects/game-phase-effects';
import {ADD_MARKER,
  HAS_MARKER,
  IS_ABILITY_BLOCKED,
  REMOVE_MARKER_AT_END_OF_TURN,
  WAS_ATTACK_USED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';
import { CheckPokemonTypeEffect } from '../../../game/store/effects/check-effects';
import { KNOCKED_OUT_BY_ATTACK_DAMAGE } from '../../../game/store/prefabs/last-attack';

export class MegaGengarex extends PokemonCard {
  public stage: Stage = Stage.STAGE_2;
  public evolvesFrom: string = 'Haunter';
  protected _tags = [CardTag.POKEMON_SV_MEGA, CardTag.POKEMON_ex];
  public cardType: CardType[] = [D];
  public hp: number = 350;
  public weakness = [{ type: F }];
  public retreat = [C, C];

  public powers = [
    {
      name: 'Shadowy Concealment',
      powerType: PowerType.ABILITY,
      text: "If 1 of your [D] Pokémon is Knocked Out by damage from an attack from your opponent's Pokémon ex, that player takes 1 fewer Prize card. The effect of Shadowy Concealment doesn't stack.",
    },
  ];

  public attacks = [
    {
      name: 'Void Gale',
      cost: [D, D],
      damage: 230,
      text: 'Move an Energy from this Pokemon to 1 of your Benched Pokemon.',
    },
  ];

  public regulationMark: string = 'I';
  public set: string = 'PFL';
  public setNumber: string = '56';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Mega Gengar ex';
  public fullName: string = 'Mega Gengar ex MBG';

  private readonly VOID_GALE_MARKER = 'VOID_GALE_MARKER';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof KnockOutEffect) {
      const player = effect.player; // owner of the Pokémon that was Knocked Out
      const opponent = StateUtils.getOpponent(state, player);

      // Only when Knocked Out by damage from an attack of the opponent's Pokémon (E-04; rulings 648, 674)
      const attack = KNOCKED_OUT_BY_ATTACK_DAMAGE(state, effect);
      if (attack === undefined) {
        return state;
      }

      // Ability must be in play on player's side and not blocked
      let hasThisInPlay = false;
      player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList, card) => {
        if (card === this) {
          hasThisInPlay = true;
        }
      });
      if (!hasThisInPlay || IS_ABILITY_BLOCKED(store, state, opponent, this)) {
        return state;
      }

      // Target must be a Darkness Pokémon
      const checkType = new CheckPokemonTypeEffect(effect.target);
      store.reduceEffect(state, checkType);
      const isDarkPokemon = checkType.cardTypes.includes(D);
      if (!isDarkPokemon) {
        return state;
      }

      // The Pokémon that used the attack must be a Pokémon ex, wherever it is by now (switched to the Bench, ...)
      const attackingPokemon = attack.pokemon;
      const attackerIsEx = attackingPokemon?.hasTag(CardTag.POKEMON_ex) === true;
      if (!attackerIsEx) {
        return state;
      }

      // Prevent stacking if multiple copies are in play (mark the KO target for this resolution;
      // the check must not depend on which copy added the marker)
      const NON_STACK_MARKER = 'MEGA_GENGAR_SHADOW_HIDING_APPLIED';
      if (effect.target.marker.hasMarker(NON_STACK_MARKER)) {
        return state;
      }
      effect.target.marker.addMarker(NON_STACK_MARKER, this);

      if (effect.prizeCount > 0) {
        effect.prizeCount -= 1;
      }
    }

    if (WAS_ATTACK_USED(effect, 0, this)) {
      ADD_MARKER(this.VOID_GALE_MARKER, effect.player, this);
      return state;
    }

    if (
      effect instanceof AfterAttackEffect &&
      HAS_MARKER(this.VOID_GALE_MARKER, effect.player, this)
    ) {
      const player = effect.player;
      const hasBench = player.bench.some((b) => b.cards.length > 0);

      if (hasBench === false) {
        return state;
      }

      // Then prompt for energy movement
      return store.prompt(
        state,
        new AttachEnergyPrompt(
          player.id,
          GameMessage.ATTACH_ENERGY_TO_BENCH,
          player.active,
          PlayerType.BOTTOM_PLAYER,
          [SlotType.BENCH],
          { superType: SuperType.ENERGY },
          { allowCancel: false, min: 1, max: 1 },
        ),
        (transfers) => {
          transfers = transfers || [];
          for (const transfer of transfers) {
            const target = StateUtils.getTarget(state, player, transfer.to);
            MOVE_CARDS(store, state, player.active, target, { cards: [transfer.card], sourceCard: this });
          }
        },
      );
    }

    REMOVE_MARKER_AT_END_OF_TURN(effect, this.VOID_GALE_MARKER, this);

    return state;
  }
}
