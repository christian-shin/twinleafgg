import { PokemonCard, Stage, CardType, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { SEARCH_YOUR_DECK_FOR_POKEMON_AND_PUT_ONTO_BENCH, WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class VolbeatTWMPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [G];
  public hp: number = 70;
  public weakness = [{ type: R }];
  public resistance = [];
  public retreat = [C];

  public attacks = [{
    name: 'Quick Sign',
    cost: [C],
    damage: 0,
    canUseOnFirstTurn: true,
    text: 'If you go first, you can use this attack during your first turn. Search your deck for up to 2 Basic Pokémon and put them onto your Bench. Then, shuffle your deck.'
  }, {
    name: 'Coordinated Strike',
    cost: [C, C],
    damage: 20,
    damageCalculation: '+',
    text: 'If Illumise is on your Bench, this attack does 60 more damage.'
  }];

  public regulationMark = 'H';
  public set: string = 'TWM';
  public setNumber: string = '9';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Volbeat';
  public fullName: string = 'Volbeat TWM';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Quick Sign
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const player = effect.player;
      const openSlots = player.bench.filter(b => b.cards.length === 0).length;
      // The attack can be used even if nothing can be found; the search then does nothing.
      if (player.deck.cards.length === 0 || openSlots === 0) {
        return state;
      }
      return SEARCH_YOUR_DECK_FOR_POKEMON_AND_PUT_ONTO_BENCH(store, state, player, { stage: Stage.BASIC }, { min: 0, max: Math.min(2, openSlots) });
    }

    // Coordinated Strike
    if (WAS_ATTACK_USED(effect, 1, this)) {
      const hasIllumise = effect.player.bench.some(b => b.getPokemonCard()?.name === 'Illumise');
      if (hasIllumise) {
        effect.damage += 60;
      }
    }
    return state;
  }
}
