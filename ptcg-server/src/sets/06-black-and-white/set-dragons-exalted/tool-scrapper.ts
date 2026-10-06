import { TrainerCard } from '../../../game/store/card/trainer-card';
import { TrainerType } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { State } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

import {
  PlayerType, StateUtils, GameError, GameMessage,
  SlotType
} from '../../../game';
import { SuperType } from '../../../game/store/card/card-types';
import { DiscardEnergyPrompt, DiscardEnergyTransfer } from '../../../game/store/prompts/discard-energy-prompt';

function* playCard(next: Function, store: StoreLike, state: State, effect: TrainerEffect): IterableIterator<State> {
  const player = effect.player;
  const opponent = StateUtils.getOpponent(state, player);

  let toolsInPlay = 0;
  player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList) => {
    toolsInPlay += cardList.tools.length;
  });
  opponent.forEachPokemon(PlayerType.TOP_PLAYER, (cardList) => {
    toolsInPlay += cardList.tools.length;
  });

  if (toolsInPlay === 0) {
    throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
  }

  // We will discard this card after prompt confirmation
  effect.preventDefault = true;

  // "Choose up to 2 Pokemon Tool cards attached to Pokemon in play": the choice is over the Tools, at least 1 and
  // no cancel for a Trainer (cancelling would be choosing 0; rulings 1778, 1853)
  let transfers: DiscardEnergyTransfer[] = [];
  yield store.prompt(state, new DiscardEnergyPrompt(
    player.id,
    GameMessage.CHOOSE_CARD_TO_DISCARD,
    PlayerType.ANY,
    [SlotType.ACTIVE, SlotType.BENCH],
    { superType: SuperType.TRAINER, trainerType: TrainerType.TOOL },
    { min: 1, max: Math.min(2, toolsInPlay), allowCancel: false }
  ), results => {
    transfers = results || [];
    next();
  });

  transfers.forEach(transfer => {
    const target = StateUtils.getTarget(state, player, transfer.from);
    const owner = StateUtils.findOwner(state, target);
    MOVE_CARDS(store, state, target, owner.discard, { cards: [transfer.card], sourceCard: effect.trainerCard });
  });

  return state;
}

export class ToolScrapper extends TrainerCard {

  public trainerType: TrainerType = TrainerType.ITEM;

  public set: string = 'DRX';

  public name: string = 'Tool Scrapper';

  public fullName: string = 'Tool Scrapper DRX';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '116';

  public text: string =
    'Choose up to 2 Pokemon Tool cards attached to Pokemon in play (yours or ' +
    'your opponent\'s) and discard them.';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const generator = playCard(() => generator.next(), store, state, effect);
      return generator.next().value;
    }
    return state;
  }

}
