import { TrainerCard, TrainerType, StoreLike, State, GameError, GameMessage } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { HealEffect } from '../../../game/store/effects/game-effects';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';


export class Cook extends TrainerCard {

  public trainerType: TrainerType = TrainerType.SUPPORTER;

  public set: string = 'FST';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '228';

  public regulationMark = 'E';

  public name: string = 'Cook';

  public fullName: string = 'Cook FST';

  public text = 'Heal 70 damage from your Active Pokémon.';

  public reduceEffect(store: StoreLike, state: State, effect: Effect) {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      // A Trainer can't be played when it obviously has no effect (Rulings Compendium 851).
      if (effect.player.active.damage === 0) {
        throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
      }
      const healEffect = new HealEffect(effect.player, effect.player.active, 70);
      return store.reduceEffect(state, healEffect);
    }
    return state;
  }

}
