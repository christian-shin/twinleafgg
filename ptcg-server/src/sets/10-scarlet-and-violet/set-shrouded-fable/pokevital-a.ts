import { TrainerCard } from '../../../game/store/card/trainer-card';
import { CardTag, TrainerType } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { State } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';
import { ChoosePokemonPrompt } from '../../../game/store/prompts/choose-pokemon-prompt';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import {
  CardTarget,
  GameError,
  GameMessage,
  Player,
  PlayerType,
  PokemonCardList,
  SlotType,
} from '../../../game';
import { HealEffect, MoveCardsEffect } from '../../../game/store/effects/game-effects';

function* playCard(
  next: Function,
  store: StoreLike,
  state: State,
  effect: TrainerEffect,
): IterableIterator<State> {
  const player = effect.player;

  const blocked: CardTarget[] = [];
  let hasPokemonWithDamage: boolean = false;
  player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList, card, target) => {
    if (cardList.damage === 0) {
      blocked.push(target);
    } else {
      hasPokemonWithDamage = true;
    }
  });

  if (hasPokemonWithDamage === false) {
    throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
  }

  // Do not discard the card yet
  effect.preventDefault = true;

  let targets: PokemonCardList[] = [];
  yield store.prompt(
    state,
    new ChoosePokemonPrompt(
      player.id,
      GameMessage.CHOOSE_POKEMON_TO_HEAL,
      PlayerType.BOTTOM_PLAYER,
      [SlotType.ACTIVE, SlotType.BENCH],
      { allowCancel: false, blocked },
    ),
    (results) => {
      targets = results || [];
      next();
    },
  );

  if (targets.length === 0) {
    return state;
  }

  targets.forEach((target) => {
    // Heal Pokemon
    const healEffect = new HealEffect(player, target, 150);
    store.reduceEffect(state, healEffect);
  });

  return state;
}

export class PokeVitalA extends TrainerCard {
  public trainerType: TrainerType = TrainerType.ITEM;
  public regulationMark = 'H';
  protected _tags = [CardTag.ACE_SPEC];
  public set: string = 'SFA';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '62';
  public name: string = 'Poké Vital A';
  public fullName: string = 'PokéVital A SFA';

  public text: string = `Heal 150 damage from 1 of your Pokémon.

If this card is in your discard pile, it can't be put into your deck or hand.`;

  public canPlay(store: StoreLike, state: State, player: Player): boolean {
    let hasDamagedPokemon = false;
    player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList) => {
      if (cardList.damage > 0) {
        hasDamagedPokemon = true;
      }
    });
    if (!hasDamagedPokemon) {
      return false;
    }
    return true;
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const generator = playCard(() => generator.next(), store, state, effect);
      return generator.next().value;
    }

    // "This card can't be put into your hand or deck from the discard pile."
    // Ref: set-shrouded-fable/neutral-center.ts (same clause)
    if (effect instanceof MoveCardsEffect) {
      for (const player of state.players) {
        if (effect.source !== player.discard || !player.discard.cards.includes(this)) {
          continue;
        }
        if (effect.destination !== player.hand && effect.destination !== player.deck) {
          continue;
        }

        if (effect.cards) {
          if (!effect.cards.includes(this)) {
            continue;
          }
          effect.cards = effect.cards.filter((c) => c !== this);
          if (effect.cards.length === 0) {
            effect.preventDefault = true;
          }
        } else if (effect.count !== undefined) {
          effect.cards = player.discard.cards.filter((c) => c !== this).slice(0, effect.count);
          effect.count = undefined;
          if (effect.cards.length === 0) {
            effect.preventDefault = true;
          }
        } else {
          effect.cards = player.discard.cards.filter((c) => c !== this);
          if (effect.cards.length === 0) {
            effect.preventDefault = true;
          }
        }
      }
    }
    return state;
  }
}
