import { TrainerCard } from '../../../game/store/card/trainer-card';
import { CardTag, TrainerType } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { Player } from '../../../game/store/state/player';
import { State } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { GameError } from '../../../game/game-error';
import { GameMessage } from '../../../game/game-message';
import { MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

export class DrumsOfAwakening extends TrainerCard {
  public trainerType: TrainerType = TrainerType.ITEM;

  protected _tags = [CardTag.ACE_SPEC];

  public regulationMark = 'H';

  public set: string = 'TEF';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '141';

  public name: string = 'Awakening Drum';

  public fullName: string = 'Awakening Drum TEF';

  public text: string = 'Draw a card for each of your Ancient Pokémon in play.';

  public canPlay(store: StoreLike, state: State, player: Player): boolean {
    return true;
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const player = effect.player;

      let ancientPokemonCount = 0;

      if (player.active?.getPokemonCard()?.hasTag(CardTag.ANCIENT)) {
        ancientPokemonCount++;
      }

      player.bench.forEach((benchSpot) => {
        if (benchSpot.getPokemonCard()?.hasTag(CardTag.ANCIENT)) {
          ancientPokemonCount++;
        }
      });
      // A Trainer can't be played when it obviously has no effect: no Ancient Pokemon in play or nothing to draw
      // (ruling 851; 1733: a draw needs at least 1 card in the deck)
      if (ancientPokemonCount === 0 || player.deck.cards.length === 0) {
        throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
      }

      MOVE_CARDS(store, state, player.deck, player.hand, { count: ancientPokemonCount, sourceCard: this });
    }
    return state;
  }
}
