// Official text (Limitless, SSP 39).
import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType } from '../../../game/store/card/card-types';
import { Card, ChooseEnergyPrompt, ConfirmPrompt, GameMessage, StoreLike, State, StateUtils } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { AFTER_ATTACK, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';
import { CheckProvidedEnergyEffect } from '../../../game/store/effects/check-effects';

export class PaldeanTaurosSSP39Pool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [W];
  public hp: number = 130;
  public weakness = [{ type: L }];
  public retreat = [C, C];

  public attacks = [
    {
      name: 'Upthrusting Horns',
      cost: [C, C],
      damage: 30,
      text: 'You may put 2 Energy attached to your opponent\'s Active Stage 2 Pokémon into their hand.'
    },
    {
      name: 'Jet Headbutt',
      cost: [W, W, C],
      damage: 100,
      text: ''
    }
  ];

  public regulationMark = 'H';
  public set: string = 'SSP';
  public setNumber: string = '39';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Paldean Tauros';
  public fullName: string = 'Paldean Tauros SSP 39';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Upthrusting Horns (after Lapras SSH's Aqua Wash, limited to a Stage 2 Active;
    // asks for as many Energy as are attached, up to 2, so the prompt is always answerable).
    // The Energy is put into the hand after the damage is done
    if (AFTER_ATTACK(effect, 0, this)) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);
      const target = opponent.active.getPokemonCard();
      if (target === undefined || target.stage !== Stage.STAGE_2) {
        return state;
      }
      const checkEnergy = new CheckProvidedEnergyEffect(opponent, opponent.active);
      state = store.reduceEffect(state, checkEnergy);
      if (checkEnergy.energyMap.length === 0) {
        return state;
      }
      const count = Math.min(2, checkEnergy.energyMap.length);
      state = store.prompt(state, new ConfirmPrompt(player.id, GameMessage.WANT_TO_USE_ABILITY), wantToUse => {
        if (!wantToUse) {
          return;
        }
        store.prompt(state, new ChooseEnergyPrompt(
          player.id,
          GameMessage.CHOOSE_ENERGIES_TO_HAND,
          checkEnergy.energyMap,
          new Array(count).fill(CardType.COLORLESS),
          { allowCancel: false }
        ), energy => {
          const cards: Card[] = (energy || []).map(e => e.card);
          if (cards.length > 0) {
            MOVE_CARDS(store, state, opponent.active, opponent.hand, { cards, sourceCard: this });
          }
        });
      });
    }
    return state;
  }
}
