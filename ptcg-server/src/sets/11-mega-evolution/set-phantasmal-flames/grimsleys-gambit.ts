import { TrainerCard, TrainerType, StoreLike, State, Card, CardList, ChooseCardsPrompt, GameError, GameMessage, SuperType, CardType, Player } from '../../../game';
import { Chance } from '../../../game/core/chance';
import { MOVE_CARDS } from '../../../game/store/prefabs/prefabs';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { matchesPromptFilter } from '../../../game/store/prompts/prompt-card-filter';

export class GrimsleysGambit extends TrainerCard {
  public trainerType: TrainerType = TrainerType.SUPPORTER;
  public set: string = 'PFL';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '90';
  public regulationMark = 'I';
  public name: string = 'Grimsley\'s Move';
  public fullName: string = 'Grimsley\'s Gambit M2';
  public text: string = 'Look at the top 7 cards of your deck and put a [D] Pokémon you find there onto your Bench. Shuffle the other cards and put them on the bottom of your deck. You can\'t use this card on your first turn.';

  public canPlay(store: StoreLike, state: State, player: Player): boolean {
    if (player.supporterTurn > 0) {
      return false;
    }
    if (player.deck.cards.length === 0) {
      return false;
    }
    if (player.bench.filter(b => b.cards.length === 0).length === 0) {
      return false;
    }
    if (state.turn === 1 || state.turn === 2) {
      return false;
    }
    return true;
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {

    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const player = effect.player;

      const supporterTurn = player.supporterTurn;

      if (supporterTurn > 0) {
        throw new GameError(GameMessage.SUPPORTER_ALREADY_PLAYED);
      }

      if (player.deck.cards.length === 0) {
        throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
      }
      // Check if bench has open slots
      const openSlots = player.bench.filter(b => b.cards.length === 0);

      if (openSlots.length === 0) {
        // No open slots, throw error
        throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
      }

      if (state.turn === 1 || state.turn === 2) {
        throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
      }

      // Played from the hand (not through Mr. Mime's Look-Alike Show, which uses the effect of a Supporter in the
      // opponent's hand as an attack effect)
      const playedFromHand = !effect.usedAsAttackEffect;

      const deckTop = new CardList();
      state = MOVE_CARDS(store, state, player.deck, deckTop, { count: 7 });

      // The top 7 cards are looked at, not searched for: a [D] Pokémon you find there must be put onto the Bench
      // when played from the hand (rulings 1778, 1853); through an attack it may be skipped (ruling 1844)
      const darkFilter = { superType: SuperType.POKEMON, cardType: [CardType.DARK] };
      const mustPut = playedFromHand && deckTop.cards.some(c => matchesPromptFilter(c, darkFilter));

      let cards: Card[] = [];
      return store.prompt(state, new ChooseCardsPrompt(
        player,
        GameMessage.CHOOSE_CARD_TO_PUT_ONTO_BENCH,
        deckTop,
        darkFilter,
        { min: mustPut ? 1 : 0, max: 1, allowCancel: false }
      ), selectedCards => {
        cards = selectedCards || [];

        cards.forEach((card, index) => {
          state = MOVE_CARDS(store, state, deckTop, openSlots[index], { cards: [card] });
          openSlots[index].pokemonPlayedTurn = state.turn;
        });

        // Shuffle the other cards (the looked-at cards, not the deck) before they go to the bottom (Advanced Rulebook E-35)
        if (deckTop.cards.length > 0) {
          const perm = Chance.shuffle(deckTop.cards.length);
          const copy = deckTop.cards.slice();
          for (let i = 0; i < perm.length; i++) {
            deckTop.cards[i] = copy[perm[i]];
          }
        }

        state = MOVE_CARDS(store, state, deckTop, player.deck, { toBottom: true });
        state = MOVE_CARDS(store, state, player.supporter, player.discard, { cards: [effect.trainerCard] });
        return state;
      });
    }
    return state;
  }
}
