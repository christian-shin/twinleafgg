import {
  Card, CardType, ChooseCardsPrompt, GameMessage, PokemonCard, PokemonCardList, Stage, State, StateUtils,
  StoreLike, SuperType,
} from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { SHUFFLE_DECK, WAS_ATTACK_USED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';
import { FLIP_A_COIN_IF_HEADS_DEAL_MORE_DAMAGE } from '../../../game/store/prefabs/attack-effects';

// Ref: set-delta-reign/sandshrew.ts (Ascension)
export class EeveeTWMPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [C];
  public hp: number = 50;
  public weakness = [{ type: F }];
  public resistance = [];
  public retreat = [C];

  public attacks = [{
    name: 'Ascension',
    cost: [C],
    damage: 0,
    text: 'Search your deck for a card that evolves from this Pokémon and put it onto this Pokémon to evolve it. Then, shuffle your deck.'
  }, {
    name: 'Quick Attack',
    cost: [C, C, C],
    damage: 20,
    damageCalculation: '+',
    text: 'Flip a coin. If heads, this attack does 20 more damage.'
  }];

  public regulationMark = 'H';
  public set: string = 'TWM';
  public setNumber: string = '135';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Eevee';
  public fullName: string = 'Eevee TWM';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Ascension
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const player = effect.player;

      if (player.deck.cards.length === 0) {
        return state;
      }

      const blocked: number[] = [];
      player.deck.cards.forEach((card, index) => {
        if (!(card instanceof PokemonCard && card.evolvesFrom === this.name)) {
          blocked.push(index);
        }
      });

      if (blocked.length === player.deck.cards.length) {
        SHUFFLE_DECK(store, state, player);
        return state;
      }

      return store.prompt(state, new ChooseCardsPrompt(
        player,
        GameMessage.CHOOSE_CARD_TO_EVOLVE,
        player.deck,
        { superType: SuperType.POKEMON },
        { min: 0, max: 1, allowCancel: false, blocked },
      ), (selected: Card[] | null) => {
        const cards = selected || [];
        if (cards.length > 0) {
          const evolutionCard = cards[0] as PokemonCard;
          const pokemonCardList = StateUtils.findCardList(state, this) as PokemonCardList;
          MOVE_CARDS(store, state, player.deck, pokemonCardList, { cards: [evolutionCard], sourceCard: this });
          pokemonCardList.clearEffects();
          pokemonCardList.pokemonPlayedTurn = state.turn;
        }
        SHUFFLE_DECK(store, state, player);
      });
    }

    // Quick Attack
    if (WAS_ATTACK_USED(effect, 1, this)) {
      return FLIP_A_COIN_IF_HEADS_DEAL_MORE_DAMAGE(store, state, effect, 20);
    }
    return state;
  }
}
