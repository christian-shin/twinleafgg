import { TrainerCard } from '../../../game/store/card/trainer-card';
import { CardTag, EnergyType, TrainerType, SuperType } from '../../../game/store/card/card-types';
import { EnergyCard, GameError, GameMessage, Player, PokemonCardList, State, StateUtils, StoreLike } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { MOVE_CARDS, TRAINER_TARGET_BLOCKED } from '../../../game/store/prefabs/prefabs';

export class MegatonBlower extends TrainerCard {
  public trainerType: TrainerType = TrainerType.ITEM;
  protected _tags = [CardTag.ACE_SPEC];
  public set: string = 'SSP';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '182';
  public regulationMark = 'H';
  public name: string = 'Megaton Blower';
  public fullName: string = 'Megaton Blower SSP';
  public text: string = 'Discard all Pokémon Tools and Special Energy from all of your opponent\'s Pokémon, and discard a Stadium in play.';

  public canPlay(store: StoreLike, state: State, player: Player): boolean {
    return true;
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const player = effect.player;

      // You can't play this card for no effect (ruling n=1610): a Stadium in play, or a Tool or Special Energy
      // on one of your opponent's Pokémon, is needed (an effect that blocks it still lets you play it)
      const opponentPokemon = StateUtils.getOpponent(state, player);
      let hasTarget = StateUtils.getStadiumCard(state) !== undefined;
      [opponentPokemon.active, ...opponentPokemon.bench].forEach((list) => {
        if (list.tools.length > 0 || list.cards.some((card) =>
          card.superType === SuperType.ENERGY && (card as EnergyCard).energyType === EnergyType.SPECIAL)) {
          hasTarget = true;
        }
      });
      if (!hasTarget) {
        throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
      }

      effect.preventDefault = true;

      // Handle stadium discard if one is in play
      const stadiumCard = StateUtils.getStadiumCard(state);
      if (stadiumCard) {
        const cardList = StateUtils.findCardList(state, stadiumCard);
        if (cardList) {
          const stadiumOwner = StateUtils.findOwner(state, cardList);
          state = MOVE_CARDS(store, state, cardList, stadiumOwner.discard, {
            cards: [stadiumCard],
            sourceCard: this,
          });
        }
      }

      const opponent = StateUtils.getOpponent(state, player);

      // Function to discard special energy and tools from a PokemonCardList
      const discardSpecialEnergyAndTools = (pokemonCardList: PokemonCardList) => {
        if (TRAINER_TARGET_BLOCKED(store, state, player, this, pokemonCardList)) {
          return;
        }
        // Attached Tools live in `tools`, not in `cards`
        const cardsToDiscard = [
          ...pokemonCardList.cards.filter(
            (card) =>
              card.superType === SuperType.ENERGY &&
              (card as EnergyCard).energyType === EnergyType.SPECIAL,
          ),
          ...pokemonCardList.tools,
        ];
        if (cardsToDiscard.length > 0) {
          state = MOVE_CARDS(store, state, pokemonCardList, opponent.discard, {
            cards: cardsToDiscard,
          });
        }
      };

      // Discard from active Pokémon
      discardSpecialEnergyAndTools(opponent.active);

      // Discard from bench Pokémon
      opponent.bench.forEach((benchPokemon) => {
        if (benchPokemon.cards.length > 0) {
          discardSpecialEnergyAndTools(benchPokemon);
        }
      });

      // Move this card to discard pile
      state = MOVE_CARDS(store, state, player.supporter, player.discard, { cards: [this] });
    }

    return state;
  }
}
