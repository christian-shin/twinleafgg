import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { SEARCH_YOUR_DECK_FOR_POKEMON_AND_PUT_ONTO_BENCH, AFTER_ATTACK } from '../../../game/store/prefabs/prefabs';

export class FidoughSCRPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [P];
  public hp: number = 60;
  public weakness = [{ type: M }];
  public resistance = [];
  public retreat = [C, C];

  public attacks = [{
    name: 'Pleasant Aroma',
    cost: [C],
    damage: 0,
    text: 'Search your deck for a Basic Pokémon and put it onto your Bench. Then, shuffle your deck.'
  }, {
    name: 'Stampede',
    cost: [C],
    damage: 10,
    text: ''
  }];

  public regulationMark = 'H';
  public set: string = 'SCR';
  public setNumber: string = '66';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Fidough';
  public fullName: string = 'Fidough SCR';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Pleasant Aroma
    if (AFTER_ATTACK(effect, 0, this)) {
      const player = effect.player;
      // The attack can be used even if nothing can be found; the search then does nothing.
      if (player.deck.cards.length === 0 || !player.bench.some(b => b.cards.length === 0)) {
        return state;
      }
      return SEARCH_YOUR_DECK_FOR_POKEMON_AND_PUT_ONTO_BENCH(store, state, player, { stage: Stage.BASIC }, { min: 0, max: 1 });
    }
    return state;
  }
}
