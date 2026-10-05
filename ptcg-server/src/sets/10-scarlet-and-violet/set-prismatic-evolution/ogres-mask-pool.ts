import {
  Card, CardTag, CardTarget, ChooseCardsPrompt, ChoosePokemonPrompt, GameError, GameMessage, PlayerType,
  PokemonCard, SlotType, State, StoreLike, SuperType, TrainerCard, TrainerType,
} from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { MOVE_CARDS, TRANSFER_POKEMON_CARD_STATE } from '../../../game/store/prefabs/prefabs';

// Ref: set-chaos-rising/transformation-tome.ts (switch a Pokémon in play with one from the discard pile)
export class OgresMaskPREPool extends TrainerCard {
  public trainerType: TrainerType = TrainerType.ITEM;
  public regulationMark = 'H';
  public set: string = 'PRE';
  public setNumber: string = '118';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Ogre\'s Mask';
  public fullName: string = 'Ogre\'s Mask PRE';
  public text: string = 'Choose a Pokémon ex in your discard pile that has "Ogerpon" in its name, and switch it with 1 of your Pokémon ex in play that has "Ogerpon" in its name. Any attached cards, damage counters, Special Conditions, turns in play, and any other effects remain on the new Pokémon.';

  private isOgerponEx(card: Card | undefined): boolean {
    return card instanceof PokemonCard && card.tags.includes(CardTag.POKEMON_ex) && card.name.includes('Ogerpon');
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const player = effect.player;

      const blockedDiscard: number[] = [];
      player.discard.cards.forEach((card, index) => {
        if (!this.isOgerponEx(card)) {
          blockedDiscard.push(index);
        }
      });
      const blockedInPlay: CardTarget[] = [];
      let hasInPlay = false;
      player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList, card, target) => {
        if (this.isOgerponEx(cardList.getPokemonCard())) {
          hasInPlay = true;
        } else {
          blockedInPlay.push(target);
        }
      });

      if (blockedDiscard.length === player.discard.cards.length || !hasInPlay) {
        throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
      }

      effect.preventDefault = true;
      MOVE_CARDS(store, state, player.hand, player.supporter, { cards: [this], sourceCard: this });

      return store.prompt(state, new ChooseCardsPrompt(
        player,
        GameMessage.CHOOSE_CARD_TO_PUT_ONTO_BENCH,
        player.discard,
        { superType: SuperType.POKEMON },
        { min: 1, max: 1, allowCancel: false, blocked: blockedDiscard }
      ), selectedCards => {
        const newCard = (selectedCards || [])[0] as PokemonCard | undefined;
        if (newCard === undefined || !this.isOgerponEx(newCard)) {
          throw new GameError(GameMessage.INVALID_PROMPT_RESULT);
        }

        return store.prompt(state, new ChoosePokemonPrompt(
          player.id,
          GameMessage.CHOOSE_POKEMON_TO_SWITCH,
          PlayerType.BOTTOM_PLAYER,
          [SlotType.ACTIVE, SlotType.BENCH],
          { min: 1, max: 1, allowCancel: false, blocked: blockedInPlay }
        ), targets => {
          const slot = (targets || [])[0];
          const oldCard = slot?.getPokemonCard();
          if (slot === undefined || oldCard === undefined || !this.isOgerponEx(oldCard)) {
            throw new GameError(GameMessage.INVALID_PROMPT_RESULT);
          }

          // Put the new Pokémon in first so the slot is never vacated: attached
          // cards, damage, conditions, turns in play and markers stay on the slot.
          const oldIndex = slot.cards.indexOf(oldCard);
          MOVE_CARDS(store, state, player.discard, slot, { cards: [newCard], sourceCard: this });
          MOVE_CARDS(store, state, slot, player.discard, { cards: [oldCard], sourceCard: this });
          const newIndex = slot.cards.indexOf(newCard);
          if (newIndex !== -1 && oldIndex !== -1 && newIndex !== oldIndex) {
            slot.cards.splice(newIndex, 1);
            slot.cards.splice(Math.min(oldIndex, slot.cards.length), 0, newCard);
          }

          // It is the same Pokémon (ruling 1840): the state kept on the card object moves to the new card.
          TRANSFER_POKEMON_CARD_STATE(player, oldCard, newCard);

          MOVE_CARDS(store, state, player.supporter, player.discard, { cards: [this], sourceCard: this });
        });
      });
    }
    return state;
  }
}
