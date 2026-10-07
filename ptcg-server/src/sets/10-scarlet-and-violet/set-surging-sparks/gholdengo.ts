import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType } from '../../../game/store/card/card-types';
import { StoreLike, State, PokemonCardList, StateUtils, Resistance, ConfirmPrompt, GameMessage, ShuffleDeckPrompt } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { AfterAttackEffect } from '../../../game/store/effects/game-phase-effects';

import {WAS_ATTACK_USED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

export class Gholdengo extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public cardType: CardType[] = [CardType.METAL];
  public hp: number = 130;
  public weakness = [{ type: CardType.FIRE }];
  public resistance: Resistance[] = [{ type: CardType.GRASS, value: -30 }];
  public retreat = [CardType.COLORLESS, CardType.COLORLESS];
  public evolvesFrom = 'Gimmighoul';

  public attacks = [{
    name: 'Strike It Rich',
    cost: [CardType.METAL],
    damage: 30,
    damageCalculation: '+',
    text: 'If this Pokémon evolved from Gimmighoul during this turn, this attack does 90 more damage.'
  },
  {
    name: 'Surf Back',
    cost: [CardType.COLORLESS, CardType.COLORLESS, CardType.COLORLESS],
    damage: 100,
    text: 'You may shuffle this Pokémon and all attached cards into your deck.'
  }];

  public set: string = 'SSP';
  public regulationMark = 'H';
  public cardImage: string = 'assets/cardback.png';
  public fullName: string = 'Gholdengo SSP';
  public name: string = 'Gholdengo';
  public setNumber: string = '131';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // From Lokix PAL 21
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const cardList = StateUtils.findCardList(state, this);

      if (cardList instanceof PokemonCardList) {
        // "If this Pokémon evolved from Gimmighoul during this turn" (Advanced Rulebook E-24): a Pokémon copying
        // this attack (Zoroark's Foul Play) evolved from something else, so the card under the user decides.
        const stack = cardList.getPokemons();
        const under = stack[stack.indexOf(this) - 1];
        if (cardList.pokemonPlayedTurn === state.turn && under !== undefined && under.name === 'Gimmighoul') {
          effect.damage += 90;
        }
      }
    }

    // Surf Back (From Mew V FST): after the damage, so that the Pokémon is still there while it is dealt
    if (effect instanceof AfterAttackEffect && effect.attack === this.attacks[1]) {
      const player = effect.player;
      return store.prompt(state, new ConfirmPrompt(player.id, GameMessage.WANT_TO_USE_ABILITY), wantToUse => {
        if (wantToUse) {
          MOVE_CARDS(store, state, player.active, player.deck, { sourceCard: this });
          player.active.clearEffects();
          return store.prompt(state, new ShuffleDeckPrompt(player.id), order => {
            player.deck.applyOrder(order);
            return state;
          });
        }
        else {
          return state;
        }
      });
    }

    return state;
  }
}