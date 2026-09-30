import { ConfirmPrompt, GameError, GameMessage, Player, State, StateUtils, StoreLike, TrainerCard, TrainerType } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { DRAW_CARDS, TAKE_X_PRIZES } from '../../../game/store/prefabs/prefabs';

export class LtSurgesBargainMEGPool extends TrainerCard {
  public trainerType: TrainerType = TrainerType.SUPPORTER;
  public regulationMark = 'I';
  public set: string = 'MEG';
  public setNumber: string = '120';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Lt. Surge\'s Bargain';
  public fullName: string = 'Lt. Surge\'s Bargain MEG';
  public text: string = 'Ask your opponent if each player may take a Prize card. If yes, each player takes a Prize card. If no, you draw 4 cards.';

  public canPlay(store: StoreLike, state: State, player: Player): boolean {
    return player.supporterTurn === 0;
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);

      if (player.supporterTurn > 0) {
        throw new GameError(GameMessage.SUPPORTER_ALREADY_PLAYED);
      }

      // The opponent answers the question.
      return store.prompt(state, new ConfirmPrompt(
        opponent.id,
        GameMessage.WANT_TO_USE_ABILITY
      ), yes => {
        if (yes) {
          TAKE_X_PRIZES(store, state, player, 1, {}, () => {
            TAKE_X_PRIZES(store, state, opponent, 1);
          });
        } else {
          DRAW_CARDS(store, state, player, 4);
        }
      });
    }
    return state;
  }
}
