import { Effect } from '../../../game/store/effects/effect';
import { State } from '../../../game/store/state/state';
import { StoreLike } from '../../../game/store/store-like';
import { TrainerCard } from '../../../game/store/card/trainer-card';
import { CardType, TrainerType } from '../../../game/store/card/card-types';
import { StateUtils } from '../../../game/store/state-utils';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { EndTurnEffect } from '../../../game/store/effects/game-phase-effects';
import { PutDamageEffect, ignoresDefenderEffects } from '../../../game/store/effects/attack-effects';
import { GamePhase, Player } from '../../../game';
import { CheckPokemonTypeEffect } from '../../../game/store/effects/check-effects';
export class IronDefender extends TrainerCard {
  public trainerType: TrainerType = TrainerType.ITEM;
  public set: string = 'MEG';
  public setNumber = '118';
  public cardImage = 'assets/cardback.png';
  public regulationMark: string = 'I';
  public name: string = 'Iron Defender';
  public fullName: string = 'Iron Defender M1L';

  public text: string = 'During your opponent\'s next turn, all of your [M] Pokémon take 30 less damage from attacks from your opponent\'s Pokémon (after applying Weakness and Resistance). (This includes new Pokémon that come into play.)';

  private readonly IRON_DEFENDER_MARKER = 'IRON_DEFENDER_MARKER';

  public canPlay(store: StoreLike, state: State, player: Player): boolean {
    return true;
  }


  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      effect.player.marker.addMarker(this.IRON_DEFENDER_MARKER, this);
    }

    if (effect instanceof PutDamageEffect && !ignoresDefenderEffects(effect)) {
      const player: Player = StateUtils.findOwner(state, StateUtils.findCardList(state, this));
      const hasMarker: boolean = player.marker.hasMarker(this.IRON_DEFENDER_MARKER, this);

      const checkPokemonTypeEffect = new CheckPokemonTypeEffect(effect.target);
      store.reduceEffect(state, checkPokemonTypeEffect);

      if (hasMarker && checkPokemonTypeEffect.cardTypes.includes(CardType.METAL)) {
        // Only damage done to your Pokémon by attacks from your opponent's Pokémon
        if (
          state.phase === GamePhase.ATTACK
          && StateUtils.findOwner(state, effect.target) === player
          && StateUtils.findOwner(state, effect.source) !== player
        ) {
          effect.damage -= 30;
        }
      }
      return state;
    }

    if (effect instanceof EndTurnEffect) {
      StateUtils.getOpponent(state, effect.player).marker.removeMarker(this.IRON_DEFENDER_MARKER);
    }

    return state;
  }

}
