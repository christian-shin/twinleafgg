import { CardType, PokemonCard, PowerType, Stage, State, StoreLike } from '../../../game';
import { KnockOutEffect } from '../../../game/store/effects/game-effects';
import { ATTACK_THAT_DAMAGED_KNOCKED_OUT } from '../../../game/store/prefabs/last-attack';
import { Effect } from '../../../game/store/effects/effect';
import { IS_ABILITY_BLOCKED, WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { BLOCK_RETREAT } from '../../../game/store/prefabs/effect-of-attack-prefabs';

export class Maractus extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [G];
  public hp: number = 110;
  public weakness = [{ type: R }];
  public retreat = [C, C];

  public powers = [{
    name: 'Explosive Needle',
    powerType: PowerType.ABILITY,
    text: 'If this Pokémon is in the Active Spot and is Knocked Out by damage from an attack from your opponent\'s Pokémon, put 6 damage counters on the Attacking Pokémon.'
  }];

  public attacks = [{
    name: 'Corner',
    cost: [C],
    damage: 20,
    text: 'During your opponent\'s next turn, the Defending Pokémon can\'t retreat.'
  }];

  public set: string = 'JTG';
  public regulationMark: string = 'I';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '8';
  public name: string = 'Maractus';
  public fullName: string = 'Maractus JTG';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Explosive Needle: step 8 of the attack flow chart, when the Knock Out is checked (after every effect of the
    // attack is resolved). It was Active when the attack damaged it (ruling 1547); the Attacking Pokémon takes the
    // counters wherever it is in play, and nothing happens when it left play (ruling 1631).
    if (effect instanceof KnockOutEffect && effect.target.cards.includes(this) && !effect.preventDefault) {
      const player = effect.player;

      if (effect.target.getPokemonCard() !== this || IS_ABILITY_BLOCKED(store, state, player, this)) {
        return state;
      }

      const attack = ATTACK_THAT_DAMAGED_KNOCKED_OUT(state, effect);
      if (attack !== undefined && attack.list !== undefined) {
        attack.list.damage += 60;
      }
    }
    // Corner
    if (WAS_ATTACK_USED(effect, 0, this)) {
      return BLOCK_RETREAT(store, state, effect, this);
    }
    return state;
  }

}