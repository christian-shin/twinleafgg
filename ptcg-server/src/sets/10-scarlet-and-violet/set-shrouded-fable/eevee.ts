import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, SuperType, EnergyType } from '../../../game/store/card/card-types';
import { Card, ChooseCardsPrompt, EnergyCard, GameMessage, ShowCardsPrompt, ShuffleDeckPrompt, State, StateUtils, StoreLike } from '../../../game';
import { AttackEffect, Effect } from '../../../game/store/effects/game-effects';
import {WAS_ATTACK_USED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

function* useColorfulCatch(next: Function, store: StoreLike, state: State, effect: AttackEffect): IterableIterator<State> {
  const player = effect.player;
  const opponent = StateUtils.getOpponent(state, player);

  // The attack can be used even if the deck is empty; the search then does nothing.
  if (player.deck.cards.length === 0) {
    return state;
  }

  const maxEnergies = 3;

  const uniqueBasicEnergies = Math.min(maxEnergies, player.deck.cards
    .filter(c => c.superType === SuperType.ENERGY && c.energyType === EnergyType.BASIC)
    .map(e => (e as EnergyCard).provides[0])
    .filter((value, index, self) => self.indexOf(value) === index)
    .length);

  let cards: Card[] = [];
  yield store.prompt(state, new ChooseCardsPrompt(
    player,
    GameMessage.CHOOSE_CARD_TO_HAND,
    player.deck,
    { superType: SuperType.ENERGY, energyType: EnergyType.BASIC },
    { min: 0, max: uniqueBasicEnergies, allowCancel: false, differentTypes: true }
  ), selected => {
    cards = selected || [];
    next();
  });

  MOVE_CARDS(store, state, player.deck, player.hand, { cards: cards, sourceCard: effect.source.getPokemonCard()! });

  if (cards.length > 0) {
    yield store.prompt(state, new ShowCardsPrompt(
      opponent.id,
      GameMessage.CARDS_SHOWED_BY_THE_OPPONENT,
      cards
    ), () => next());
  }

  return store.prompt(state, new ShuffleDeckPrompt(player.id), order => {
    player.deck.applyOrder(order);
  });
}

export class Eevee extends PokemonCard {

  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [C];
  public hp: number = 70;
  public weakness = [{ type: F }];
  public retreat = [C];

  public attacks = [
    {
      name: 'Colorful Catch',
      cost: [C],
      damage: 0,
      text: 'Search your deck for up to 3 Basic Energy cards of different types, ' +
        'reveal them, and put them into your hand. Then, shuffle your deck.'
    },
    { name: 'Headbutt', cost: [C, C], damage: 20, text: '' },
  ];

  public regulationMark: string = 'H';
  public set: string = 'SFA';
  public name: string = 'Eevee';
  public fullName: string = 'Eevee SFA';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '50';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {

    if (WAS_ATTACK_USED(effect, 0, this)) {
      const generator = useColorfulCatch(() => generator.next(), store, state, effect);
      return generator.next().value;
    }

    return state;
  }
}