import { PokemonCard, Stage, CardType, CardTag, StoreLike, State } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { WAS_ATTACK_USED, WAS_POKEMON_KNOCKED_OUT_DURING_OPPONENTS_LAST_TURN } from '../../../game/store/prefabs/prefabs';
import { BLOCK_RETREAT } from '../../../game/store/prefabs/effect-of-attack-prefabs';

// Ref: set-destined-rivals/ethans-pinsir.ts (tagged KO during opponent's last turn)
export class HopsTrevenantASCPool extends PokemonCard {
  protected _tags = [CardTag.HOPS];
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom: string = 'Hop\'s Phantump';
  public cardType: CardType[] = [P];
  public hp: number = 140;
  public weakness = [{ type: D }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C, C];

  public attacks = [{
    name: 'Horrifying Revenge',
    cost: [C],
    damage: 30,
    damageCalculation: '+',
    text: 'If any of your Hop\'s Pokémon were Knocked Out by damage from an attack during your opponent\'s last turn, this attack does 100 more damage.'
  }, {
    name: 'Corner',
    cost: [P, C, C],
    damage: 90,
    text: 'During your opponent\'s next turn, the Defending Pokémon can\'t retreat.'
  }];

  public regulationMark = 'I';
  public set: string = 'ASC';
  public setNumber: string = '96';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Hop\'s Trevenant';
  public fullName: string = 'Hop\'s Trevenant ASC';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Horrifying Revenge
    if (WAS_ATTACK_USED(effect, 0, this)) {
      if (WAS_POKEMON_KNOCKED_OUT_DURING_OPPONENTS_LAST_TURN(effect.player, { byAttackDamage: true, tags: [CardTag.HOPS] })) {
        effect.damage += 100;
      }
    }

    // Corner
    if (WAS_ATTACK_USED(effect, 1, this)) {
      return BLOCK_RETREAT(store, state, effect, this);
    }
    return state;
  }
}
