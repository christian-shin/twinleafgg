import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType } from '../../../game/store/card/card-types';
import { StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { DiscardCardsEffect } from '../../../game/store/effects/attack-effects';
import { CheckProvidedEnergyEffect } from '../../../game/store/effects/check-effects';
import { THIS_ATTACK_DOES_X_DAMAGE_TO_1_OF_YOUR_OPPONENTS_BENCHED_POKEMON } from '../../../game/store/prefabs/attack-effects';

export class Armarouge extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom = 'Charcadet';
  public cardType: CardType[] = [R];
  public hp: number = 140;
  public weakness = [{ type: W }];
  public retreat = [C, C];

  public attacks = [
    {
      name: 'Combustion',
      cost: [C, C],
      damage: 50,
      text: ''
    },
    {
      name: 'Crimson Blaster',
      cost: [R, R, C],
      damage: 0,
      text: 'Discard all [R] Energy from this Pokémon, and this attack does 180 damage to 1 of your opponent\'s Benched Pokémon. (Don\'t apply Weakness and Resistance for Benched Pokémon.)'
    },
  ];

  public set: string = 'SSP';
  public regulationMark: string = 'H';
  public setNumber: string = '34';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Armarouge';
  public fullName: string = 'Armarouge SSP';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (WAS_ATTACK_USED(effect, 1, this)) {
      const player = effect.player;

      // "Discard all [R] Energy": every Energy that provides [R], including one that provides every type
      // (Legacy Energy, Prism Energy on a Basic Pokémon), which can't be left out (Advanced Rulebook D-08).
      const checkProvidedEnergy = new CheckProvidedEnergyEffect(player);
      store.reduceEffect(state, checkProvidedEnergy);
      const fireEnergy = checkProvidedEnergy.energyMap
        .filter(e => e.provides.includes(CardType.FIRE) || e.provides.includes(CardType.ANY))
        .map(e => e.card)
        .filter((card, i, all) => all.indexOf(card) === i);

      const discardEnergy = new DiscardCardsEffect(effect, fireEnergy);
      discardEnergy.target = player.active;
      store.reduceEffect(state, discardEnergy);

      THIS_ATTACK_DOES_X_DAMAGE_TO_1_OF_YOUR_OPPONENTS_BENCHED_POKEMON(180, effect, store, state);
    }

    return state;
  }

}
