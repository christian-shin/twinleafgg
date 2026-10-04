import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, SuperType } from '../../../game/store/card/card-types';
import { PowerType, StoreLike, State, ConfirmPrompt, GameMessage, StateUtils, ChooseCardsPrompt } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { PlayPokemonEffect } from '../../../game/store/effects/play-card-effects';
import {IS_ABILITY_BLOCKED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';
import { AfterAttackEffect } from '../../../game/store/effects/game-phase-effects';

export class ChienPao extends PokemonCard {

  public stage: Stage = Stage.BASIC;

  public regulationMark = 'H';

  public cardType: CardType[] = [W];

  public hp: number = 120;

  public weakness = [{ type: M }];

  public retreat = [C];

  public powers = [{
    name: 'Snow Sink',
    powerType: PowerType.ABILITY,
    text: 'When you play this Pokémon from your hand onto your Bench during your turn, you may discard a Stadium in play.'
  }];

  public attacks = [
    {
      name: 'Icicle Loop',
      cost: [W, W, C],
      damage: 120,
      text: 'Put an Energy attached to this Pokémon into your hand.'
    }
  ];

  public set: string = 'SSP';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '56';

  public name: string = 'Chien-Pao';

  public fullName: string = 'Chien-Pao SSP';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof PlayPokemonEffect && effect.pokemonCard === this) {

      if (IS_ABILITY_BLOCKED(store, state, effect.player, this)) { return state; }

      const stadiumCard = StateUtils.getStadiumCard(state);
      if (stadiumCard !== undefined) {

        state = store.prompt(state, new ConfirmPrompt(
          effect.player.id,
          GameMessage.WANT_TO_USE_ABILITY,
        ), wantToUse => {
          if (wantToUse) {

            // Discard Stadium
            const cardList = StateUtils.findCardList(state, stadiumCard);
            const player = StateUtils.findOwner(state, cardList);
            MOVE_CARDS(store, state, cardList, player.discard, { sourceCard: this });
            return state;
          }
          return state;
        });
      }
    }

    // Icicle Loop: after the damage, put 1 Energy attached to this Pokémon into your hand
    if (effect instanceof AfterAttackEffect && effect.attack === this.attacks[0]) {
      const player = effect.player;

      if (!player.active.energies.cards.some(c => c.superType === SuperType.ENERGY)) {
        return state;
      }

      state = store.prompt(state, new ChooseCardsPrompt(
        player,
        GameMessage.CHOOSE_CARD_TO_HAND,
        player.active,
        { superType: SuperType.ENERGY },
        { min: 1, max: 1, allowCancel: false }
      ), cards => {
        MOVE_CARDS(store, state, player.active, player.hand, { cards: cards || [], sourceCard: this });
      });
    }

    return state;
  }
}