import { TrainerCard } from '../../../game/store/card/trainer-card';
import { SuperType, TrainerType } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { State, GamePhase } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';
import { AfterDamageEffect } from '../../../game/store/effects/attack-effects';
import { AfterAttackEffect, EndTurnEffect } from '../../../game/store/effects/game-phase-effects';
import { StateUtils } from '../../../game/store/state-utils';
import { AttachEnergyPrompt, CardTarget, GameMessage, PlayerType, SlotType } from '../../../game';
import { ToolEffect } from '../../../game/store/effects/play-card-effects';
import { MOVE_CARDS } from '../../../game/store/prefabs/prefabs';
import { PokemonCardList } from '../../../game/store/state/pokemon-card-list';

export class HandyFan extends TrainerCard {
  public regulationMark = 'H';
  public trainerType: TrainerType = TrainerType.TOOL;
  public set: string = 'TWM';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '150';
  public name = 'Handheld Fan';
  public fullName = 'Handheld Fan TWM';

  public text: string = 'Whenever the Active Pokémon this card is attached to takes damage from an opponent\'s attack, move an Energy from the attacking Pokémon to 1 of your opponent\'s Benched Pokémon.';

  public readonly HANDY_FAN_MARKER = 'HANDY_FAN_MARKER';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // The damage arms the effect on the attacking Pokémon (its slot, wherever it is when the attack
    // is over); it resolves after the attack's own effects (ruling 1625, 1649, 1650, 1651).
    if (effect instanceof AfterDamageEffect && effect.target.tools.includes(this)) {
      const player = effect.player;
      const targetPlayer = StateUtils.findOwner(state, effect.target);

      if (effect.damage <= 0 || player === targetPlayer || targetPlayer.active !== effect.target) {
        return state;
      }

      // Try to reduce ToolEffect, to check if something is blocking the tool from working
      try {
        const stub = new ToolEffect(targetPlayer, this);
        store.reduceEffect(state, stub);
      } catch {
        return state;
      }

      if (state.phase === GamePhase.ATTACK) {
        effect.source.marker.addMarker(this.HANDY_FAN_MARKER, this);
      }
      return state;
    }

    if (effect instanceof AfterAttackEffect) {
      const player = effect.player;
      const opponent = effect.opponent;

      let attackingPokemon: PokemonCardList | undefined;
      player.forEachPokemon(PlayerType.BOTTOM_PLAYER, cardList => {
        if (cardList.marker.hasMarker(this.HANDY_FAN_MARKER, this)) {
          attackingPokemon = cardList;
        }
      });
      if (attackingPokemon === undefined) {
        return state;
      }
      const attacker: PokemonCardList = attackingPokemon;
      attacker.marker.removeMarker(this.HANDY_FAN_MARKER, this);

      // The Energy moves to one of the attacking player's other Benched Pokémon; an attacker that
      // left play (Aqua Return) or has no Energy left has nothing to move.
      const attackerBenchIndex = player.bench.indexOf(attacker);
      const hasBench = player.bench.some(b => b.cards.length > 0 && b !== attacker);
      const hasEnergy = attacker.cards.some(c => c.superType === SuperType.ENERGY);

      if (attacker.cards.length === 0 || hasBench === false || hasEnergy === false) {
        return state;
      }

      const blockedTo: CardTarget[] = [];
      if (attackerBenchIndex !== -1) {
        blockedTo.push({ player: PlayerType.TOP_PLAYER, slot: SlotType.BENCH, index: attackerBenchIndex });
      }

      return store.prompt(state, new AttachEnergyPrompt(
        opponent.id,
        GameMessage.ATTACH_ENERGY_TO_BENCH,
        attacker,
        PlayerType.TOP_PLAYER,
        [SlotType.BENCH],
        { superType: SuperType.ENERGY },
        { allowCancel: false, min: 1, max: 1, blockedTo }
      ), transfers => {
        transfers = transfers || [];
        for (const transfer of transfers) {
          const target = StateUtils.getTarget(state, opponent, transfer.to);
          MOVE_CARDS(store, state, attacker, target, { cards: [transfer.card], sourceCard: this });
        }
      });
    }

    if (effect instanceof EndTurnEffect) {
      effect.player.forEachPokemon(PlayerType.BOTTOM_PLAYER, cardList => {
        cardList.marker.removeMarker(this.HANDY_FAN_MARKER, this);
      });
    }

    return state;
  }
}
