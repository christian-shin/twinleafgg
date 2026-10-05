import { GameError, PokemonCard, Player, pokemonHasCardType } from '../../../game';
import { GameMessage } from '../../../game/game-message';
import { Card } from '../../../game/store/card/card';
import { CardType, EnergyType, SuperType, TrainerType } from '../../../game/store/card/card-types';
import { TrainerCard } from '../../../game/store/card/trainer-card';
import { Effect } from '../../../game/store/effects/effect';
import { DiscardToHandEffect, TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { ChooseCardsPrompt } from '../../../game/store/prompts/choose-cards-prompt';
import { ShowCardsPrompt } from '../../../game/store/prompts/show-cards-prompt';
import { StateUtils } from '../../../game/store/state-utils';
import { State } from '../../../game/store/state/state';
import { StoreLike } from '../../../game/store/store-like';
import { MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

function* playCard(next: Function, store: StoreLike, state: State, self: Tarragon, effect: TrainerEffect): IterableIterator<State> {
  const player = effect.player;
  const opponent = StateUtils.getOpponent(state, player);
  let cards: Card[] = [];

  const supporterTurn = player.supporterTurn;

  if (supporterTurn > 0) {
    throw new GameError(GameMessage.SUPPORTER_ALREADY_PLAYED);
  }

  // Played from the hand (not through Mr. Mime's Look-Alike Show, which uses the effect of a Supporter in the
  // opponent's hand as an attack effect)
  const playedFromHand = !effect.usedAsAttackEffect;

  let pokemons = 0;
  let energies = 0;
  const blocked: number[] = [];
  player.discard.cards.forEach((c, index) => {
    if (c.superType === SuperType.ENERGY && c.energyType === EnergyType.BASIC && c.name === 'Fighting Energy') {
      energies += 1;
    } else if (c instanceof PokemonCard && pokemonHasCardType(c, CardType.FIGHTING)) {
      pokemons += 1;
    } else {
      blocked.push(index);
    }
  });

  // No [F] Pokémon or Basic [F] Energy in the discard pile: it is public knowledge that the card would do nothing
  // (rulings 851, 948)
  if (pokemons === 0 && energies === 0) {
    throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
  }

  MOVE_CARDS(store, state, player.hand, player.supporter, { cards: [effect.trainerCard], sourceCard: self });
  // We will discard this card after prompt confirmation
  effect.preventDefault = true;

  const maxPokemons = Math.min(pokemons, 4);
  const maxEnergies = Math.min(energies, 4);
  const count = 4;

  yield store.prompt(state, new ChooseCardsPrompt(
    player,
    GameMessage.CHOOSE_CARD_TO_HAND,
    player.discard,
    {},
    // "up to 4" from a public zone: at least 1 from the hand (rulings 1778, 1853), 0 through an attack (ruling 1844)
    { min: playedFromHand ? 1 : 0, max: count, allowCancel: false, blocked, maxPokemons, maxEnergies }
  ), selected => {
    cards = selected || [];
    next();
  });

  MOVE_CARDS(store, state, player.discard, player.hand, { cards: cards, sourceCard: self });

  if (cards.length > 0) {
    yield store.prompt(state, new ShowCardsPrompt(
      opponent.id,
      GameMessage.CARDS_SHOWED_BY_THE_OPPONENT,
      cards
    ), () => next());
  }
}

export class Tarragon extends TrainerCard {
  public trainerType: TrainerType = TrainerType.SUPPORTER;
  public set: string = 'POR';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '85';
  public regulationMark = 'J';
  public name: string = 'Tarragon';
  public fullName: string = 'Tarragon M3';
  public text: string = 'Put up to 4 in any combination of [F] Pokémon and Basic [F] Energy cards from your discard pile into your hand.';

  public canPlay(store: StoreLike, state: State, player: Player): boolean {
    if (player.supporterTurn > 0) {
      return false;
    }
    return true;
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const player = effect.player;

      // Check if DiscardToHandEffect is prevented
      const discardEffect = new DiscardToHandEffect(player, this);
      store.reduceEffect(state, discardEffect);

      if (discardEffect.preventDefault) {
        // If prevented, just discard the card and return

        return state;
      }

      const generator = playCard(() => generator.next(), store, state, this, effect);
      return generator.next().value;
    }
    return state;
  }
}