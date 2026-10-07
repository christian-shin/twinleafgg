import { TrainerCard } from '../../../game/store/card/trainer-card';
import { TrainerType, CardTag } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { State } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';
import { CheckAttackCostEffect } from '../../../game/store/effects/check-effects';
import { ToolEffect } from '../../../game/store/effects/play-card-effects';

export class SparklingCrystal extends TrainerCard {
  public trainerType: TrainerType = TrainerType.TOOL;

  protected _tags = [CardTag.ACE_SPEC];

  public set: string = 'SCR';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '142';

  public regulationMark = 'H';

  public name: string = 'Sparkling Crystal';

  public fullName: string = 'Sparkling Crystal SCR';

  public text: string =
    'When the Tera Pokémon this card is attached to uses an attack, that attack costs 1 Energy less. (The Energy can be of any type.)';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof CheckAttackCostEffect && effect.player.active.tools.includes(this)) {
      const pokemonCard = effect.player.active.getPokemonCard();

      // Try to reduce ToolEffect, to check if something is blocking the tool from working
      try {
        const stub = new ToolEffect(effect.player, this);
        store.reduceEffect(state, stub);
      } catch {
        return state;
      }

      if (pokemonCard && pokemonCard.hasTag(CardTag.POKEMON_TERA)) {
        // "Costs 1 Energy less" of any type: applied with the other cost changes after all handlers ran (check-effect.ts)
        effect.anyEnergyReduction = true;
      }
    }
    return state;
  }
}
