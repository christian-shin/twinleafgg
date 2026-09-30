import { PokemonCard, Stage, CardType, PowerType, StoreLike, State, StateUtils, GameError, GameMessage } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { PlayPokemonEffect } from '../../../game/store/effects/play-card-effects';
import {
  ABILITY_USED, DRAW_CARDS, HAS_MARKER, IS_ABILITY_BLOCKED, REMOVE_MARKER_AT_END_OF_TURN, USE_ABILITY_ONCE_PER_TURN,
  WAS_ATTACK_USED, WAS_POWER_USED,
} from '../../../game/store/prefabs/prefabs';

// Refs: set-pitch-black/toucannon.ts (once per turn ability), set-vivid-voltage/alcremie.ts (each player draws)
export class ChandelureTWMPool extends PokemonCard {
  public stage: Stage = Stage.STAGE_2;
  public evolvesFrom: string = 'Lampent';
  public cardType: CardType[] = [R];
  public hp: number = 130;
  public weakness = [{ type: W }];
  public resistance = [];
  public retreat = [C, C];

  public powers = [{
    name: 'Alluring Light',
    useWhenInPlay: true,
    powerType: PowerType.ABILITY,
    text: 'Once during your turn, you may have each player draw a card.'
  }];

  public attacks = [{
    name: 'Mind Ruler',
    cost: [R],
    damage: 30,
    damageCalculation: 'x',
    text: 'This attack does 30 damage for each card in your opponent\'s hand.'
  }];

  public regulationMark = 'H';
  public set: string = 'TWM';
  public setNumber: string = '38';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Chandelure';
  public fullName: string = 'Chandelure TWM';

  public readonly ALLURING_LIGHT_MARKER = 'TWM_CHANDELURE_ALLURING_LIGHT';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof PlayPokemonEffect && effect.pokemonCard === this) {
      effect.player.marker.removeMarker(this.ALLURING_LIGHT_MARKER, this);
    }

    // Alluring Light
    if (WAS_POWER_USED(effect, 0, this)) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);

      if (IS_ABILITY_BLOCKED(store, state, player, this)) {
        throw new GameError(GameMessage.BLOCKED_BY_EFFECT);
      }
      if (HAS_MARKER(this.ALLURING_LIGHT_MARKER, player, this)) {
        throw new GameError(GameMessage.POWER_ALREADY_USED);
      }
      if (player.deck.cards.length === 0 && opponent.deck.cards.length === 0) {
        throw new GameError(GameMessage.CANNOT_USE_POWER);
      }

      USE_ABILITY_ONCE_PER_TURN(player, this.ALLURING_LIGHT_MARKER, this);
      ABILITY_USED(player, this);
      DRAW_CARDS(store, state, player, 1);
      DRAW_CARDS(store, state, opponent, 1);
    }

    REMOVE_MARKER_AT_END_OF_TURN(effect, this.ALLURING_LIGHT_MARKER, this);

    // Mind Ruler
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const opponent = StateUtils.getOpponent(state, effect.player);
      effect.damage = 30 * opponent.hand.cards.length;
    }
    return state;
  }
}
