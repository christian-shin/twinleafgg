import {
  CardList, CardTag, ChoosePrizePrompt, ConfirmPrompt, GameError, GameMessage, ShowCardsPrompt,
  State, StateUtils, StoreLike, TrainerCard, TrainerType,
} from '../../../game';
import { Chance } from '../../../game/core/chance';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

// Refs: set-shrouded-fable/cresselia.ts (turn a Prize card face up), team-rockets-chingling.ts (Chance.index random hand card)
export class TeamRocketsBotherBotDRIPool extends TrainerCard {
  protected _tags = [CardTag.TEAM_ROCKET];
  public trainerType: TrainerType = TrainerType.ITEM;
  public regulationMark = 'I';
  public set: string = 'DRI';
  public setNumber: string = '172';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Team Rocket\'s Bother-Bot';
  public fullName: string = 'Team Rocket\'s Bother-Bot DRI';
  public text: string = 'Turn 1 of your opponent\'s face-down Prize cards face up and choose a random card from your opponent\'s hand. Your opponent reveals that card. You may have your opponent switch those cards. (That Prize card remains face up for the rest of the game.)';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);

      const prizes = opponent.prizes.filter(p => p.cards.length > 0);
      const blocked: number[] = [];
      prizes.forEach((p, index) => {
        if (p.faceUpPrize) {
          blocked.push(index);
        }
      });
      if (blocked.length === prizes.length) {
        throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
      }

      effect.preventDefault = true;
      MOVE_CARDS(store, state, player.hand, player.supporter, { cards: [this], sourceCard: this });

      return store.prompt(state, new ChoosePrizePrompt(
        player.id,
        GameMessage.CHOOSE_PRIZE_CARD,
        { count: 1, allowCancel: false, useOpponentPrizes: true, blocked, faceDownOnly: true }
      ), chosen => {
        const prize: CardList | undefined = (chosen || [])[0];
        if (prize === undefined || prize.faceUpPrize) {
          throw new GameError(GameMessage.INVALID_PROMPT_RESULT);
        }

        // That Prize card remains face up for the rest of the game.
        prize.isSecret = false;
        prize.isPublic = true;
        prize.faceUpPrize = true;

        const finish = () => {
          MOVE_CARDS(store, state, player.supporter, player.discard, { cards: [this], sourceCard: this });
        };

        if (opponent.hand.cards.length === 0) {
          return store.prompt(state, new ShowCardsPrompt(
            player.id, GameMessage.CARDS_SHOWED_BY_THE_OPPONENT, [...prize.cards]
          ), () => finish());
        }

        const handCard = opponent.hand.cards[Chance.index(opponent.hand.cards.length)];

        return store.prompt(state, new ShowCardsPrompt(
          player.id, GameMessage.CARDS_SHOWED_BY_THE_OPPONENT, [...prize.cards, handCard]
        ), () => {
          return store.prompt(state, new ConfirmPrompt(
            player.id, GameMessage.WANT_TO_USE_ABILITY
          ), wantToSwitch => {
            if (wantToSwitch) {
              const prizeCards = [...prize.cards];
              MOVE_CARDS(store, state, prize, opponent.hand, { cards: prizeCards, sourceCard: this });
              MOVE_CARDS(store, state, opponent.hand, prize, { cards: [handCard], sourceCard: this });
              prize.isSecret = false;
              prize.isPublic = true;
              prize.faceUpPrize = true;
            }
            finish();
          });
        });
      });
    }
    return state;
  }
}
