import { TrainerCard } from '../../../game/store/card/trainer-card';
import { TrainerType } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { State } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';
import { AfterDamageEffect, AttackTriggerEffect } from '../../../game/store/effects/attack-effects';
import { StateUtils } from '../../../game/store/state-utils';
import { ATTACK_TRIGGER } from '../../../game/store/prefabs/after-damage';
import { ToolEffect } from '../../../game/store/effects/play-card-effects';
import { MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

export class LuckyHelmet extends TrainerCard {

  public regulationMark = 'H';

  public trainerType: TrainerType = TrainerType.TOOL;

  public set: string = 'TWM';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '158';

  public name = 'Lucky Helmet';

  public fullName = 'Lucky Helmet TWM';

  public text: string =
    'If the Pokémon this card is attached to is in the Active Spot and is damaged by an attack from your opponent\'s Pokémon (even if it is Knocked Out), draw 2 cards.';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {

    if (effect instanceof AfterDamageEffect && effect.target.tools.includes(this)) {
      const player = effect.player;
      const targetPlayer = StateUtils.findOwner(state, effect.target);

      if (effect.damage <= 0 || player === targetPlayer || targetPlayer.active !== effect.target) {
        return state;
      }

      // Step 7 of the attack flow chart: it resolves after the effects of the attack's own text.
      return ATTACK_TRIGGER(store, state, effect, this);
    }

    if (effect instanceof AttackTriggerEffect && effect.card === this) {
      // An attack that discarded this card stops it (ruling 1649)
      if (!effect.target.tools.includes(this)) {
        return state;
      }

      // Try to reduce ToolEffect, to check if something is blocking the tool from working
      try {
        const stub = new ToolEffect(effect.player, this);
        store.reduceEffect(state, stub);
      } catch {
        return state;
      }

      // Draws even if the Attacking Pokémon switched or left play (ruling 1827)
      MOVE_CARDS(store, state, effect.opponent.deck, effect.opponent.hand, { count: 2, sourceCard: this });
    }
    return state;
  }
}
