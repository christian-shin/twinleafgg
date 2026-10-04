import { Chance } from '../../../game/core/chance';
import { Card, GameError, GameMessage, Player, State, StoreLike, TrainerCard, TrainerType } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

export class RedeemableTicket extends TrainerCard {

  public trainerType: TrainerType = TrainerType.ITEM;

  public regulationMark = 'I';

  public set: string = 'JTG';

  public name: string = 'Redeemable Ticket';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '156';

  public fullName: string = 'Redeemable Ticket JTG';

  public text: string =
    'Count your Prize cards and shuffle them face down, then put them at the bottom of your deck. If you do, add that many cards from the top of your deck to your Prize cards.';

  public canPlay(store: StoreLike, state: State, player: Player): boolean {
    if (player.getPrizeLeft() === 0) {
      return false;
    }
    return true;
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const player = effect.player;
      const prizes = player.prizes.filter(p => p.cards.length > 0);
      const prizeCount = prizes.reduce((sum, p) => sum + p.cards.length, 0);

      if (prizeCount === 0) {
        throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
      }

      // Move the trainer card to discard
      MOVE_CARDS(store, state, player.hand, player.discard, { cards: [effect.trainerCard], sourceCard: this });

      // Collect all prize cards
      const allPrizeCards: Card[] = [];
      prizes.forEach(p => allPrizeCards.push(...p.cards));

      // Shuffle the prize cards
      this.shuffleArray(allPrizeCards);

      // Move prize cards to the bottom of the deck
      allPrizeCards.forEach(card => {
        player.deck.cards.push(card);
      });

      // Clear the prize cards
      prizes.forEach(p => p.cards = []);

      // Draw cards from the top of the deck to the prize cards
      for (let i = 0; i < prizeCount; i++) {
        const card = player.deck.cards.shift();
        if (card) {
          const prize = player.prizes.find(p => p.cards.length === 0);
          if (prize) {
            prize.cards.push(card);
          } else {
            player.deck.cards.unshift(card);
          }
        }
      }

      // Set the new prize cards to be face down
      player.prizes.forEach(p => { p.isSecret = true; p.isPublic = false; p.faceUpPrize = false; });
      MOVE_CARDS(store, state, player.supporter, player.discard, { cards: [this], sourceCard: this });
      return state;
    }

    return state;
  }

  private shuffleArray<T>(array: T[]): void {
    { const __perm = Chance.shuffle(array.length); const __copy = array.slice(); for (let i = 0; i < __perm.length; i++) { array[i] = __copy[__perm[i]]; } }
  }
}