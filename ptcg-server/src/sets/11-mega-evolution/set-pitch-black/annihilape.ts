import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType } from '../../../game/store/card/card-types';
import { GameMessage, PlayerType, PowerType, SlotType, StateUtils, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { PutCountersEffect, PutDamageEffect } from '../../../game/store/effects/attack-effects';
import { ChoosePokemonPrompt } from '../../../game/store/prompts/choose-pokemon-prompt';
import { IS_ABILITY_BLOCKED, AFTER_ATTACK } from '../../../game/store/prefabs/prefabs';
import { SURVIVE_ON_TEN_ON_COIN_FLIP } from '../../../game/store/prefabs/effect-of-attack-prefabs';

export class Annihilape extends PokemonCard {
  public stage: Stage = Stage.STAGE_2;
  public evolvesFrom: string = 'Primeape';
  public cardType: CardType[] = [P];
  public hp: number = 150;
  public weakness = [{ type: D }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C, C];

  public powers = [{
    name: 'Durable Body',
    powerType: PowerType.ABILITY,
    text: 'If this Pokémon would be Knocked Out by damage from an attack, flip a coin. If heads, this Pokémon is not Knocked Out, and its remaining HP becomes 10.',
  }];

  public attacks = [{
    name: 'Ghostly Blow',
    cost: [P, P],
    damage: 100,
    text: "Place 5 damage counters on 1 of your opponent's Benched Pokémon.",
  }];

  public set: string = 'PBL';
  public setNumber: string = '41';

  public regulationMark: string = 'J';

  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Annihilape';
  public fullName: string = 'Annihilape M5';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Ref: set-ascended-heroes/mega-hawlucha-ex.ts (Tenacious Body)
    if (
      effect instanceof PutDamageEffect &&
      effect.target.cards.includes(this) &&
      effect.target.getPokemonCard() === this
    ) {
      const owner = StateUtils.findOwner(state, effect.target);

      if (IS_ABILITY_BLOCKED(store, state, owner, this)) {
        return state;
      }

      SURVIVE_ON_TEN_ON_COIN_FLIP(store, state, effect, owner, this.powers[0].name);
    }

    if (AFTER_ATTACK(effect, 0, this)) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);

      if (!opponent.bench.some((b) => b.cards.length > 0)) {
        return state;
      }

      return store.prompt(
        state,
        new ChoosePokemonPrompt(
          player.id,
          GameMessage.CHOOSE_POKEMON_TO_DAMAGE,
          PlayerType.TOP_PLAYER,
          [SlotType.BENCH],
          { allowCancel: false, min: 1, max: 1 },
        ),
        (picked) => {
          if (!picked || picked.length === 0) {
            return;
          }
          const dest = picked[0];
          // Damage counters placed by an attack are an effect of the attack (Mist Energy, ... prevent them)
          const putCounters = new PutCountersEffect(effect.attackEffect, 50);
          putCounters.target = dest;
          store.reduceEffect(state, putCounters);
        },
      );
    }

    return state;
  }
}
