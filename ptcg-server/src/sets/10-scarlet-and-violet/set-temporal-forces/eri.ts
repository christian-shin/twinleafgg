import { TrainerCard } from '../../../game/store/card/trainer-card';
import { TrainerType, SuperType } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { State } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { ChooseCardsPrompt, GameError, GameMessage, Player, StateUtils } from '../../../game';
import { MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

export class Eri extends TrainerCard {

  public regulationMark = 'H';

  public trainerType: TrainerType = TrainerType.SUPPORTER;

  public set: string = 'TEF';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '146';

  public name: string = 'Eri';

  public fullName: string = 'Eri TEF';

  public text: string =
    'Your opponent reveals their hand. Discard up to 2 Item cards you find there.';

  public canPlay(store: StoreLike, state: State, player: Player): boolean {
    if (player.supporterTurn > 0) {
      return false;
    }
    return true;
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);

      const supporterTurn = player.supporterTurn;

      if (supporterTurn > 0) {
        throw new GameError(GameMessage.SUPPORTER_ALREADY_PLAYED);
      }

      // A Trainer can't be played when it obviously has no effect: the opponent's hand is empty (ruling 880)
      if (opponent.hand.cards.length === 0) {
        throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
      }

      MOVE_CARDS(store, state, player.hand, player.supporter, { cards: [effect.trainerCard], sourceCard: this });
      // We will discard this card after prompt confirmation
      effect.preventDefault = true;

      // "Discard up to 2 Item cards you find there": when there is an Item, at least 1 must be discarded
      // (Rulings Compendium: a Supporter can't choose to discard zero Item cards); used as the effect of
      // an attack (Look-Alike Show) it may discard zero (ruling 1844).
      const hasItem = opponent.hand.cards.some(c => c instanceof TrainerCard && c.trainerType === TrainerType.ITEM);

      return store.prompt(state, new ChooseCardsPrompt(
        player,
        GameMessage.CHOOSE_CARD_TO_DISCARD,
        opponent.hand,
        { superType: SuperType.TRAINER, trainerType: TrainerType.ITEM },
        { allowCancel: false, min: hasItem && !effect.usedAsAttackEffect ? 1 : 0, max: 2 }
      ), cards => {
        if (cards === null || cards.length === 0) {
          MOVE_CARDS(store, state, player.supporter, player.discard, { cards: [this], sourceCard: this });
          return;
        }
        MOVE_CARDS(store, state, player.supporter, player.discard, { cards: [this], sourceCard: this });
        cards.forEach(card => {
          MOVE_CARDS(store, state, opponent.hand, opponent.discard, { cards: [card], sourceCard: this });

        });
      });
    }
    return state;
  }
}
