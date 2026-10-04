import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, CardTag } from '../../../game/store/card/card-types';
import { StoreLike, State } from '../../../game';

import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class HoOh extends PokemonCard {
  public stage: Stage = Stage.BASIC;

  public regulationMark = 'H';

  public cardType: CardType[] = [CardType.FIRE];

  public hp: number = 130;

  public weakness = [{ type: CardType.LIGHTNING }];

  public resistance = [{ type: CardType.FIGHTING, value: -30 }];

  public retreat = [CardType.COLORLESS, CardType.COLORLESS];

  public attacks = [
    {
      name: 'Flap',
      cost: [CardType.FIRE, CardType.COLORLESS],
      damage: 50,
      text: '',
    },
    {
      name: 'Shining Blaze',
      cost: [CardType.FIRE, CardType.FIRE, CardType.COLORLESS],
      damage: 100,
      damageCalculation: '+',
      text: 'If you have any Tera Pokémon on your Bench, this attack does 100 more damage.',
    },
  ];

  public set: string = 'SSP';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '19';

  public name: string = 'Ho-Oh';

  public fullName: string = 'Ho-Oh SSP';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (WAS_ATTACK_USED(effect, 1, this)) {
      const player = effect.player;

      const hasTeraPokemonOnBench = player.bench.some(b => {
        const card = b.getPokemonCard();
        return card !== undefined && card.hasTag(CardTag.POKEMON_TERA);
      });

      if (hasTeraPokemonOnBench) {
        effect.damage += 100;
      }
    }

    return state;
  }
}
