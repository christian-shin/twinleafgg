/* eslint-disable indent */
import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { State } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';

import { CardTag } from '../../../game/store/card/card-types';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class Koraidon extends PokemonCard {
  protected _tags = [CardTag.ANCIENT];

  public regulationMark = 'H';

  public stage: Stage = Stage.BASIC;

  public cardType: CardType[] = [CardType.DRAGON];

  public hp: number = 140;

  public retreat = [CardType.COLORLESS, CardType.COLORLESS];

  public attacks = [
    {
      name: 'Primordial Beatdown',
      cost: [CardType.FIGHTING, CardType.COLORLESS],
      damage: 30,
      damageCalculator: 'x',
      text: 'This attack does 30 damage for each of your Ancient Pokémon in play.',
    },
    {
      name: 'Shred',
      cost: [CardType.FIRE, CardType.FIGHTING, CardType.COLORLESS],
      damage: 130,
      shredAttack: true,
      text: "This attack's damage isn't affected by any effects on your opponent's Active Pokémon.",
    },
  ];

  public set: string = 'TEF';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '119';

  public name: string = 'Koraidon';

  public fullName: string = 'Koraidon TEF';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const player = effect.player;

      let ancientPokemonCount = 0;

      if (player.active?.getPokemonCard()?.hasTag(CardTag.ANCIENT)) {
        ancientPokemonCount++;
      }

      player.bench.forEach((benchSpot) => {
        if (benchSpot.getPokemonCard()?.hasTag(CardTag.ANCIENT)) {
          ancientPokemonCount++;
        }
      });

      effect.damage = 30 * ancientPokemonCount;
    }

    if (WAS_ATTACK_USED(effect, 1, this)) {
      // Shred: effects on the Defending Pokémon don't change the damage; Weakness, Resistance and
      // effects on the attacker still apply.
      effect.ignoreDefenderEffects = true;
    }
    return state;
  }
}
