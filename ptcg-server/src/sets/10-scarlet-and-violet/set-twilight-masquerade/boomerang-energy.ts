import { StoreLike, State } from '../../../game';
import { CardType, EnergyType } from '../../../game/store/card/card-types';
import { EnergyCard } from '../../../game/store/card/energy-card';
import { DiscardCardsEffect } from '../../../game/store/effects/attack-effects';
import { Effect } from '../../../game/store/effects/effect';
import {IS_SPECIAL_ENERGY_BLOCKED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';
import { EndTurnEffect } from '../../../game/store/effects/game-phase-effects';

export class BoomerangEnergy extends EnergyCard {
  public provides: CardType[] = [CardType.COLORLESS];
  public energyType = EnergyType.SPECIAL;
  public set: string = 'TWM';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '166';
  public regulationMark = 'H';
  public name = 'Boomerang Energy';
  public fullName = 'Boomerang Energy TWM';

  public text = `As long as this card is attached to a Pokémon, it provides [C] Energy.
    
  If this card is discarded by an effect of an attack used by the Pokémon this card is attached to, attach this card from your discard pile to that Pokémon after attacking.`;

  public readonly BOOMERANG_DISCARDED_MARKER = 'BOOMERANG_DISCARDED_MARKER';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // checking if this card is discarded by an attack of the Pokémon it is attached to
    if (effect instanceof DiscardCardsEffect && effect.cards.includes(this) && effect.source.cards.includes(this) && effect.player.active === effect.source) {
      if (IS_SPECIAL_ENERGY_BLOCKED(store, state, effect.player, this, effect.source)) {
        return state;
      }
      effect.player.marker.addMarker(this.BOOMERANG_DISCARDED_MARKER, this);
    }

    // removing the marker and handling the reattaching of it
    if (effect instanceof EndTurnEffect && effect.player.marker.hasMarker(this.BOOMERANG_DISCARDED_MARKER, this)) {
      effect.player.marker.removeMarker(this.BOOMERANG_DISCARDED_MARKER, this);

      // this card was discarded by the attack, move it onto the active
      if (effect.player.active !== undefined) {
        effect.player.discard.cards.forEach(card => {
          if (card === this) {
            MOVE_CARDS(store, state, effect.player.discard, effect.player.active, { cards: [card], sourceCard: this });
          }
        });
      }
    }
    return state;
  }
}