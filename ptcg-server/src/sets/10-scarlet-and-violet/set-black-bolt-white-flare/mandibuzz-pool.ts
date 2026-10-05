import {
  PokemonCard, Stage, CardType, PowerType, StoreLike, State, StateUtils, GameError, GameMessage,
  ChooseCardsPrompt, ShowCardsPrompt, SuperType,
} from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { PlayPokemonEffect } from '../../../game/store/effects/play-card-effects';
import {
  ABILITY_USED, HAS_MARKER, IS_ABILITY_BLOCKED, MOVE_CARDS, REMOVE_MARKER_AT_END_OF_TURN,
  USE_ABILITY_ONCE_PER_TURN, WAS_POWER_USED,
} from '../../../game/store/prefabs/prefabs';

// Refs: set-pitch-black/toucannon.ts (once per turn ability), set-151/erikas-invitation.ts (opponent's hand to their Bench)
export class MandibuzzWHTPool extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom: string = 'Vullaby';
  public cardType: CardType[] = [D];
  public hp: number = 110;
  public weakness = [{ type: L }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C];

  public powers = [{
    name: 'Look for Prey',
    useWhenInPlay: true,
    powerType: PowerType.ABILITY,
    text: 'Once during your turn, you may use this Ability. Your opponent reveals their hand, and you put a Basic Pokémon with 70 HP or less that you find there onto your opponent\'s Bench.'
  }];

  public attacks = [{
    name: 'Cutting Wind',
    cost: [C, C, C],
    damage: 90,
    text: ''
  }];

  public regulationMark = 'I';
  public set: string = 'WHT';
  public setNumber: string = '64';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Mandibuzz';
  public fullName: string = 'Mandibuzz WHT';

  public readonly LOOK_FOR_PREY_MARKER = 'WHT_MANDIBUZZ_LOOK_FOR_PREY';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof PlayPokemonEffect && effect.pokemonCard === this) {
      effect.player.marker.removeMarker(this.LOOK_FOR_PREY_MARKER, this);
    }

    // Look for Prey
    if (WAS_POWER_USED(effect, 0, this)) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);

      if (IS_ABILITY_BLOCKED(store, state, player, this)) {
        throw new GameError(GameMessage.BLOCKED_BY_EFFECT);
      }
      if (HAS_MARKER(this.LOOK_FOR_PREY_MARKER, player, this)) {
        throw new GameError(GameMessage.POWER_ALREADY_USED);
      }
      if (opponent.hand.cards.length === 0) {
        throw new GameError(GameMessage.CANNOT_USE_POWER);
      }
      // A full opposing Bench is public knowledge: the Ability can't be used (rulings 46, 70, 1634)
      if (opponent.bench.every(b => b.cards.length > 0)) {
        throw new GameError(GameMessage.CANNOT_USE_POWER);
      }

      USE_ABILITY_ONCE_PER_TURN(player, this.LOOK_FOR_PREY_MARKER, this);
      ABILITY_USED(player, this);

      const slots = opponent.bench.filter(b => b.cards.length === 0);
      const blocked: number[] = [];
      opponent.hand.cards.forEach((card, index) => {
        if (!(card instanceof PokemonCard && card.stage === Stage.BASIC && card.hp <= 70)) {
          blocked.push(index);
        }
      });
      const hasTarget = blocked.length < opponent.hand.cards.length;

      if (slots.length === 0 || !hasTarget) {
        // Nothing can be put onto the Bench: the hand is still revealed.
        return store.prompt(state, new ShowCardsPrompt(
          player.id,
          GameMessage.CARDS_SHOWED_BY_THE_OPPONENT,
          [...opponent.hand.cards]
        ), () => state);
      }

      return store.prompt(state, new ChooseCardsPrompt(
        player,
        GameMessage.CHOOSE_CARD_TO_PUT_ONTO_BENCH,
        opponent.hand,
        { superType: SuperType.POKEMON, stage: Stage.BASIC },
        { min: 1, max: 1, allowCancel: false, blocked }
      ), selected => {
        const cards = selected || [];
        if (cards.length === 0) {
          return;
        }
        MOVE_CARDS(store, state, opponent.hand, slots[0], { cards: [cards[0]], sourceCard: this });
        slots[0].pokemonPlayedTurn = state.turn;
      });
    }

    REMOVE_MARKER_AT_END_OF_TURN(effect, this.LOOK_FOR_PREY_MARKER, this);

    return state;
  }
}
