import { CardType, EnergyType } from '../../../game/store/card/card-types';
import { EnergyCard } from '../../../game/store/card/energy-card';
import { StoreLike } from '../../../game/store/store-like';
import { State, GamePhase } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';
import { StateUtils } from '../../../game';
import { AfterDamageEffect, PutCountersEffect } from '../../../game/store/effects/attack-effects';
import { IS_SPECIAL_ENERGY_BLOCKED } from '../../../game/store/prefabs/prefabs';
import { AFTER_DAMAGE_OR_NOW } from '../../../game/store/prefabs/after-damage';


export class SpikyEnergy extends EnergyCard {

  public provides: CardType[] = [C];

  public energyType = EnergyType.SPECIAL;

  public regulationMark = 'I';

  public set: string = 'JTG';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '159';

  public name = 'Spiky Energy';

  public fullName = 'Spiky Energy JTG';

  public text =
    'As long as this card is attached to a Pokémon, it provides [C] Energy. \n' +
    'If the Pokémon this card is attached to is in the Active Spot and is damaged by an attack ' +
    'from your opponent\'s Pokémon (even if it is Knocked Out), put 2 damage counters on the Attacking Pokémon.';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {

    // Triggers when the Pokémon is damaged: not when the damage was prevented or reduced to 0 (AfterDamageEffect,
    // like Punk Helmet and Lucky Helmet), even if it is Knocked Out (the Knock Out is checked later)
    if (effect instanceof AfterDamageEffect && effect.target.cards.includes(this) && state.phase === GamePhase.ATTACK) {
      const player = StateUtils.findOwner(state, effect.target);
      const opponent = effect.player;
      if (player === opponent || player.active !== effect.target)
        return state;

      if (IS_SPECIAL_ENERGY_BLOCKED(store, state, effect.player, this, effect.target)) {
        return state;
      }
      // Step 7 of the attack flow chart: the effects on the Defending Pokémon come after the effects of the
      // attack's own text, so an attack that discards this card (Duraludon's Hyper Beam) stops it.
      const damaged = effect.target;
      return AFTER_DAMAGE_OR_NOW(state, effect.attackEffect, s => {
        if (!damaged.cards.includes(this)) {
          return s;
        }
        const putCountersEffect = new PutCountersEffect(effect, 20);
        putCountersEffect.target = effect.source;
        return store.reduceEffect(s, putCountersEffect);
      });
    }
    return state;
  }

}
