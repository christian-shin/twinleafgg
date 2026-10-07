import { Card } from './card/card';
import { CardList } from './state/card-list';
import { Player } from './state/player';
import { State } from './state/state';

/**
 * Who owns a card: the player whose deck it was in at the start of the game (Advanced Rulebook C-01:
 * a discarded card always goes to its owner's discard pile). Kept outside the card and the state, so it is
 * neither serialized nor part of the canonical state.
 */
const cardOwners = new WeakMap<Card, Player>();

export function SET_CARD_OWNER(card: Card, player: Player): void {
  cardOwners.set(card, player);
}

/**
 * Cards just put into a player's discard pile that belong to the other player (the Energy Handheld Fan moved
 * to your Pokémon, discarded when that Pokémon is Knocked Out) go to their owner's discard pile instead.
 */
export function RETURN_CARDS_TO_OWNERS_DISCARD(state: State, destination: CardList): void {
  const holder = state.players.find(p => p.discard === destination);
  if (holder === undefined) {
    return;
  }
  const foreign = destination.cards.filter(card => {
    const owner = cardOwners.get(card);
    return owner !== undefined && owner !== holder;
  });
  foreign.forEach(card => {
    destination.moveCardTo(card, cardOwners.get(card)!.discard);
  });
}
