import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { SEARCH_YOUR_DECK_FOR_POKEMON_AND_PUT_ONTO_BENCH, WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class LitwickTWMPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [R];
  public hp: number = 60;
  public weakness = [{ type: W }];
  public resistance = [];
  public retreat = [C];

  public attacks = [{
    name: 'Call for Family',
    cost: [R],
    damage: 0,
    text: 'Search your deck for a Basic Pokémon and put it onto your Bench. Then, shuffle your deck.'
  }, {
    name: 'Live Coal',
    cost: [R, C],
    damage: 20,
    text: ''
  }];

  public regulationMark = 'H';
  public set: string = 'TWM';
  public setNumber: string = '36';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Litwick';
  public fullName: string = 'Litwick TWM';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Call for Family
    if (WAS_ATTACK_USED(effect, 0, this)) {
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
