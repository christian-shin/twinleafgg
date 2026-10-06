import { CardType, TrainerType } from '../../../game/store/card/card-types';
import { TrainerCard } from '../../../game/store/card/trainer-card';
import { AfterDamageEffect, AttackTriggerEffect } from '../../../game/store/effects/attack-effects';
import { CheckPokemonTypeEffect } from '../../../game/store/effects/check-effects';
import { Effect } from '../../../game/store/effects/effect';
import { ATTACK_TRIGGER } from '../../../game/store/prefabs/after-damage';
import { ToolEffect } from '../../../game/store/effects/play-card-effects';

import { StateUtils } from '../../../game/store/state-utils';
import { GamePhase, State } from '../../../game/store/state/state';
import { StoreLike } from '../../../game/store/store-like';

export class PunkHelmet extends TrainerCard {
  public trainerType: TrainerType = TrainerType.TOOL;
  public set: string = 'PFL';
  public name: string = 'Punk Helmet';
  public fullName: string = 'Punk Helmet PFL';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '92';
  public regulationMark: string = 'I';

  public text: string =
    'If the [D] Pokémon this card is attached to is in the Active Spot and is damaged by an attack from your opponent\'s Pokémon (even if this Pokémon is Knocked Out), place 4 damage counters on the Attacking Pokémon.';

  public damageDealt = false;

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

      const checkPokemonType = new CheckPokemonTypeEffect(effect.target);
      store.reduceEffect(state, checkPokemonType);

      // Not when the Attacking Pokémon left play (ruling 530); on the Bench it still gets the counters (ruling 1839)
      if (checkPokemonType.cardTypes.includes(CardType.DARK) && state.phase === GamePhase.ATTACK && effect.sourceInPlay) {
        effect.source.damage += 40;
      }
    }

    return state;
  }

}
