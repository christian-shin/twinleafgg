import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, EnergyType, SuperType } from '../../../game/store/card/card-types';
import { State } from '../../../game/store/state/state';

import { StoreLike } from '../../../game/store/store-like';
import { Effect } from '../../../game/store/effects/effect';
import { AttachEnergyPrompt, GameMessage, PlayerType, ShuffleDeckPrompt, SlotType, StateUtils } from '../../../game';
import {SHUFFLE_DECK, MOVE_CARDS, AFTER_ATTACK } from '../../../game/store/prefabs/prefabs';

export class Smoochum extends PokemonCard {

  public regulationMark = 'H';

  public stage = Stage.BASIC;

  public cardType: CardType[] = [CardType.PSYCHIC];

  public hp = 30;

  public weakness = [{ type: CardType.DARK }];

  public resistance = [{ type: CardType.FIGHTING, value: -30 }];

  public retreat = [];

  public attacks = [
    {
      name: 'Happy Kiss',
      cost: [],
      damage: 0,
      text: 'Search your deck for up to 2 Basic [P] Energy cards and attach them to 1 of your Benched Pokémon. Then, shuffle your deck.'
    }
  ];

  public set: string = 'SSP';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '75';

  public name: string = 'Smoochum';

  public fullName: string = 'Smoochum SSP';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {

    if (AFTER_ATTACK(effect, 0, this)) {
      const player = effect.player;

      // The attack can be used with an empty deck; the search then fails (rulings 337, 1790)
      if (player.deck.cards.length === 0) {
        return state;
      }

      state = store.prompt(state, new AttachEnergyPrompt(
        player.id,
        GameMessage.ATTACH_ENERGY_TO_BENCH,
        player.deck,
        PlayerType.BOTTOM_PLAYER,
        [SlotType.BENCH],
        { superType: SuperType.ENERGY, energyType: EnergyType.BASIC, name: 'Psychic Energy' },
        { allowCancel: false, min: 0, max: 2, sameTarget: true },
      ), transfers => {
        transfers = transfers || [];
        // cancelled by user
        if (transfers.length === 0) {
          SHUFFLE_DECK(store, state, player);
          return state;
        }
        for (const transfer of transfers) {
          const target = StateUtils.getTarget(state, player, transfer.to);
          MOVE_CARDS(store, state, player.deck, target, { cards: [transfer.card], sourceCard: this });
        }
      });

      return store.prompt(state, new ShuffleDeckPrompt(player.id), order => {
        player.deck.applyOrder(order);
        return state;
      });
    }
    return state;
  }
}