import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, CardTag } from '../../../game/store/card/card-types';
import { ChoosePokemonPrompt, GameError, GameMessage, PlayerType, ShuffleDeckPrompt, SlotType, State, StateUtils, StoreLike } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { PutDamageEffect, ignoresDefenderEffects } from '../../../game/store/effects/attack-effects';
import { EndTurnEffect } from '../../../game/store/effects/game-phase-effects';
import {WAS_ATTACK_USED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';
import { DEFENDING_POKEMON_DOES_LESS_DAMAGE } from '../../../game/store/prefabs/effect-of-attack-prefabs';

export class Sylveonex extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom = 'Eevee';
  protected _tags = [CardTag.POKEMON_ex, CardTag.POKEMON_TERA];
  public cardType: CardType[] = [P];
  public hp: number = 270;
  public weakness = [{ type: M }];
  public retreat = [C, C];

  public readonly ANGELITE_MARKER = 'ANGELITE_MARKER';
  public readonly CLEAR_ANGELITE_MARKER = 'CLEAR_ANGELITE_MARKER';

  public attacks = [{
    name: 'Magical Charm',
    cost: [P, C, C],
    damage: 160,
    text: 'During your opponent\'s next turn, the Defending Pokemon\'s attacks do 100 less damage (before applying Weakness and Resistance).'
  },
  {
    name: 'Angelite',
    cost: [W, L, P],
    damage: 0,
    text: 'Choose 2 of your opponent\'s Benched Pokémon. They shuffle those Pokémon and all attached cards into their deck. If 1 of your Pokémon used Angelite during your last turn, this attack can\'t be used.'
  }];

  public regulationMark = 'H';
  public set: string = 'SSP';
  public setNumber: string = '86';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Sylveon ex';
  public fullName: string = 'Sylveon ex SSP';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // "If 1 of your Pokémon used Angelite during your last turn": the markers are
    // not tied to this card, any Pokémon of the player that used Angelite counts.
    if (effect instanceof EndTurnEffect && effect.player.marker.hasMarker(this.CLEAR_ANGELITE_MARKER, this)) {
      effect.player.marker.removeMarker(this.ANGELITE_MARKER);
      effect.player.marker.removeMarker(this.CLEAR_ANGELITE_MARKER, this);
    }

    if (
      effect instanceof EndTurnEffect &&
      effect.player.marker.hasMarker(this.ANGELITE_MARKER)
    ) {
      effect.player.marker.addMarker(this.CLEAR_ANGELITE_MARKER, this);
    }

    // Magical Charm
    if (WAS_ATTACK_USED(effect, 0, this)) {
      return DEFENDING_POKEMON_DOES_LESS_DAMAGE(store, state, effect, this, 100);
    }

    // Angelite
    if (WAS_ATTACK_USED(effect, 1, this)) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);
      const benchCount = opponent.bench.filter((b) => b.cards.length > 0).length;

      if (effect.player.marker.hasMarker(this.ANGELITE_MARKER)) {
        throw new GameError(GameMessage.BLOCKED_BY_EFFECT);
      }
      effect.player.marker.addMarker(this.ANGELITE_MARKER, this);

      if (benchCount === 0) {
        return state;
      }

      return store.prompt(
        state,
        new ChoosePokemonPrompt(
          player.id,
          GameMessage.CHOOSE_POKEMON_TO_DAMAGE,
          PlayerType.TOP_PLAYER,
          [SlotType.BENCH],
          { min: Math.min(2, benchCount), max: 2, allowCancel: false },
        ),
        (selected) => {
          const targets = selected || [];

          targets.forEach((target) => {
            MOVE_CARDS(store, state, target, opponent.deck, { sourceCard: this });

            return store.prompt(state, new ShuffleDeckPrompt(opponent.id), (order) => {
              opponent.deck.applyOrder(order);
            });
          });
        },
      );
    }

    if (
      effect instanceof PutDamageEffect && !ignoresDefenderEffects(effect) &&
      effect.target.cards.includes(this) &&
      effect.target.getPokemonCard() === this
    ) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);

      if (effect.target === player.active || effect.target === opponent.active) {
        return state;
      }

      effect.preventDefault = true;
    }

    return state;
  }
}
