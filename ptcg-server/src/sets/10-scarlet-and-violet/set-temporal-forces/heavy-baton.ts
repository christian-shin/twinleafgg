import { TrainerCard } from '../../../game/store/card/trainer-card';
import { EnergyType, SuperType, TrainerType } from '../../../game/store/card/card-types';
import { StoreLike, State, StateUtils, GamePhase, CardList, AttachEnergyPrompt, GameMessage, PlayerType, SlotType } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { KnockOutEffect } from '../../../game/store/effects/game-effects';
import { PutDamageEffect } from '../../../game/store/effects/attack-effects';
import { CheckRetreatCostEffect } from '../../../game/store/effects/check-effects';
import { IS_TOOL_BLOCKED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

export class HeavyBaton extends TrainerCard {

  public regulationMark = 'H';

  public trainerType: TrainerType = TrainerType.TOOL;

  public set: string = 'TEF';

  public name: string = 'Heavy Baton';

  public fullName: string = 'Heavy Baton PAR';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '151';

  public text: string =
    'If the Pokémon this card is attached to has a Retreat Cost of 4 or higher, is in the Active Spot, and is Knocked Out by damage from an attack from your opponent\'s Pokémon, move up to 3 Basic Energy cards from that Pokémon to your Benched Pokémon in any way you like.';

  public readonly HEAVY_BATON_MARKER = 'HEAVY_BATON_MARKER';
  // Set when the Pokémon is damaged by an attack while it is the Active Pokémon with a Retreat Cost of exactly 4.
  public readonly HEAVY_BATON_ACTIVE_MARKER = 'HEAVY_BATON_ACTIVE_MARKER';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {

    // The criteria are checked when the damage is dealt: an attack that moves the Pokémon to the
    // Bench before the Knock Out is checked (Exciting Dance, Push Down) doesn't stop Heavy Baton (ruling 1547).
    // The latest damage from an opponent's attack decides; the marker is consumed by the Knock Out.
    if (effect instanceof PutDamageEffect && effect.target.tools.includes(this)) {
      const owner = StateUtils.findOwner(state, effect.target);
      if (state.phase === GamePhase.ATTACK && effect.player !== owner) {
        effect.target.marker.removeMarker(this.HEAVY_BATON_ACTIVE_MARKER, this);
        if (owner.active === effect.target && !effect.preventDefault && effect.damage > 0
          && !IS_TOOL_BLOCKED(store, state, owner, this)) {
          const checkRetreatCost = new CheckRetreatCostEffect(owner);
          store.reduceEffect(state, checkRetreatCost);
          if (checkRetreatCost.cost.length === 4) {
            // A Trainer's effect on the Pokémon: it stays when the Pokémon moves to the Bench.
            effect.target.marker.addMarker(this.HEAVY_BATON_ACTIVE_MARKER, this, 'trainer', 'pokemon');
          }
        }
      }
    }

    if (effect instanceof KnockOutEffect && effect.target.tools.includes(this)) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);
      const active = effect.target;

      if (IS_TOOL_BLOCKED(store, state, player, this)) { return state; }

      // Do not activate between turns, or when it's not opponents turn.
      if (state.phase !== GamePhase.ATTACK || state.players[state.activePlayer] !== opponent) {
        return state;
      }

      if (active.marker.hasMarker(this.HEAVY_BATON_MARKER)) {
        return state;
      }

      // Check if this tool is attached to the active Pokemon
      if (!active.tools.includes(this)) {
        return state;
      }

      // Only when it was damaged by an attack while in the Active Spot with a Retreat Cost of exactly 4
      // (checked when the damage was dealt) and Knocked Out by damage from an attack
      const wasActive = active.marker.hasMarker(this.HEAVY_BATON_ACTIVE_MARKER, this);
      active.marker.removeMarker(this.HEAVY_BATON_ACTIVE_MARKER, this);
      if (!wasActive || !player.marker.hasMarker(player.DAMAGE_DEALT_MARKER)) {
        return state;
      }

      const pokemonCard = active.getPokemonCard();
      if (!pokemonCard) {
        return state;
      }

      // Get all basic energy cards from the active Pokemon
      const basicEnergyCards = active.cards.filter(c => c.superType === SuperType.ENERGY && c.energyType === EnergyType.BASIC);

      if (basicEnergyCards.length === 0) {
        return state;
      }

      // Add marker, do not invoke this effect for other wishful batons
      active.marker.addMarker(this.HEAVY_BATON_MARKER, this);

      // Make copy of the basic energy cards, because they will be transferred to discard shortly
      const energyToAttach = new CardList();
      energyToAttach.cards = basicEnergyCards.slice();

      state = store.prompt(state, new AttachEnergyPrompt(
        player.id,
        GameMessage.ATTACH_ENERGY_TO_BENCH,
        energyToAttach,
        PlayerType.BOTTOM_PLAYER,
        [SlotType.BENCH],
        { superType: SuperType.ENERGY, energyType: EnergyType.BASIC },
        { allowCancel: true, min: 0, max: 3 }
      ), transfers => {
        transfers = transfers || [];
        active.marker.removeMarker(this.HEAVY_BATON_MARKER);

        for (const transfer of transfers) {
          const target = StateUtils.getTarget(state, player, transfer.to);
          MOVE_CARDS(store, state, player.discard, target, { cards: [transfer.card] });
        }
      });
    }

    return state;
  }
}