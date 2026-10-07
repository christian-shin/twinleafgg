import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, SuperType } from '../../../game/store/card/card-types';
import { StoreLike, State, PokemonCardList, Card, ChooseCardsPrompt, ShuffleDeckPrompt, PlayerType } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { PlayPokemonFromDeckEffect } from '../../../game/store/effects/play-card-effects';
import { AttackEffect } from '../../../game/store/effects/game-effects';
import { GameMessage } from '../../../game/game-message';
import { AFTER_ATTACK } from '../../../game/store/prefabs/prefabs';

function* useFlock(next: Function, store: StoreLike, state: State,
  effect: AttackEffect): IterableIterator<State> {
  const player = effect.player;
  const slots: PokemonCardList[] = player.bench.filter(b => b.cards.length === 0);
  const max = Math.min(slots.length, 2);
  // A full Bench is public knowledge: the attack does nothing, without even searching (ruling 337)
  if (max === 0) {
    return state;
  }
  // All 4 copies in known zones (discard pile, in play): the search can't find any (ruling 336)
  let knownCopies = player.discard.cards.filter(c => c.name === 'Froakie').length;
  player.forEachPokemon(PlayerType.BOTTOM_PLAYER, cardList => {
    knownCopies += cardList.cards.filter(c => c.name === 'Froakie').length;
  });
  if (knownCopies >= 4) {
    return state;
  }

  let cards: Card[] = [];
  yield store.prompt(state, new ChooseCardsPrompt(
    player,
    GameMessage.CHOOSE_CARD_TO_PUT_ONTO_BENCH,
    player.deck,
    { superType: SuperType.POKEMON, stage: Stage.BASIC, name: 'Froakie' },
    { min: 0, max, allowCancel: false }
  ), selected => {
    cards = selected || [];
    next();
  });

  if (cards.length > slots.length) {
    cards.length = slots.length;
  }

  cards.forEach((card, index) => {
    store.reduceEffect(state, new PlayPokemonFromDeckEffect(player, card as PokemonCard, slots[index]));
  });

  return store.prompt(state, new ShuffleDeckPrompt(player.id), order => {
    player.deck.applyOrder(order);
  });
}

export class Froakie extends PokemonCard {

  public regulationMark = 'H';

  public stage: Stage = Stage.BASIC;

  public cardType: CardType[] = [CardType.WATER];

  public hp: number = 60;

  public weakness = [{ type: CardType.LIGHTNING }];

  public retreat = [CardType.COLORLESS];

  public attacks = [
    {
      name: 'Flock',
      cost: [CardType.WATER],
      damage: 0,
      text: 'Search your deck for up to 2 Froakie and put them onto your Bench. Then, shuffle your deck.'
    },
    {
      name: 'Flop',
      cost: [CardType.WATER],
      damage: 10,
      text: ''
    }
  ];

  public set: string = 'TWM';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '56';

  public name: string = 'Froakie';

  public fullName: string = 'Froakie TWM';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {

    if (AFTER_ATTACK(effect, 0, this)) {
      const generator = useFlock(() => generator.next(), store, state, effect.attackEffect);
      return generator.next().value;
    }

    return state;
  }

}
