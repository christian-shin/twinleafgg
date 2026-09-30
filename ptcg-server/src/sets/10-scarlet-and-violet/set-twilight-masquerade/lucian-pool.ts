import { Card, GameError, GameMessage, Player, State, StateUtils, StoreLike, TrainerCard, TrainerType } from '../../../game';
import { Chance } from '../../../game/core/chance';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { COIN_FLIP_PROMPT, DRAW_CARDS, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

// Refs: set-paldea-evolved/iono.ts (hands to the bottom of the deck), set-surging-sparks/meddling-memo.ts (Chance.shuffle)
export class LucianTWMPool extends TrainerCard {
  public trainerType: TrainerType = TrainerType.SUPPORTER;
  public regulationMark = 'H';
  public set: string = 'TWM';
  public setNumber: string = '157';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Lucian';
  public fullName: string = 'Lucian TWM';
  public text: string = 'Each player shuffles their hand and puts it on the bottom of their deck. If either player put any cards on the bottom of their deck in this way, each player flips a coin. If heads, that player draws 6 cards. If tails, they draw 3 cards.';

  public canPlay(store: StoreLike, state: State, player: Player): boolean {
    if (player.supporterTurn > 0) {
      return false;
    }
    const opponent = StateUtils.getOpponent(state, player);
    return player.hand.cards.some(c => c !== this) || opponent.hand.cards.length > 0;
  }

  private shuffled(cards: Card[]): Card[] {
    const perm = Chance.shuffle(cards.length);
    return perm.map(i => cards[i]);
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);

      if (player.supporterTurn > 0) {
        throw new GameError(GameMessage.SUPPORTER_ALREADY_PLAYED);
      }

      const playerCards = player.hand.cards.filter(c => c !== this);
      const opponentCards = [...opponent.hand.cards];
      if (playerCards.length === 0 && opponentCards.length === 0) {
        throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
      }

      // Cards moved without toTop are appended, i.e. put on the bottom of the deck.
      if (playerCards.length > 0) {
        MOVE_CARDS(store, state, player.hand, player.deck, { cards: this.shuffled(playerCards), sourceCard: this });
      }
      if (opponentCards.length > 0) {
        MOVE_CARDS(store, state, opponent.hand, opponent.deck, { cards: this.shuffled(opponentCards), sourceCard: this });
      }

      return COIN_FLIP_PROMPT(store, state, player, playerHeads => {
        COIN_FLIP_PROMPT(store, state, opponent, opponentHeads => {
          DRAW_CARDS(store, state, player, playerHeads ? 6 : 3);
          DRAW_CARDS(store, state, opponent, opponentHeads ? 6 : 3);
        });
      });
    }
    return state;
  }
}
