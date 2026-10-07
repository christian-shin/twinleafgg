import { PokemonCard, Stage, CardTag, CardType, PowerType, StoreLike, State, GameMessage, ConfirmPrompt } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { AfterAttackEffect } from '../../../game/store/effects/game-phase-effects';
import { CheckPokemonAttacksEffect } from '../../../game/store/effects/check-effects';
import { IS_ABILITY_BLOCKED, SWITCH_ACTIVE_WITH_BENCHED } from '../../../game/store/prefabs/prefabs';

export class Mewex extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  protected _tags = [CardTag.POKEMON_ex];
  public hp: number = 160;
  public cardType: CardType[] = [P];
  public weakness = [{ type: D }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [];

  public powers = [{
    name: 'Memory Helix',
    useWhenInPlay: false,
    powerType: PowerType.ABILITY,
    text: 'This Pokémon can use the attacks of any of your Benched Pokémon. (You still need the necessary Energy to use each attack.)',
  }];

  public attacks = [{
    name: 'Teleportation Burst',
    cost: [P],
    damage: 30,
    text: 'You may switch this Pokémon with 1 of your Benched Pokémon.',
  }];

  public regulationMark: string = 'J';
  public set: string = 'M6a';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '57';
  public name: string = 'Mew ex';
  public fullName: string = 'Mew ex 30C';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Memory Helix: a passive Ability; the attacks of the Benched Pokémon are this Pokémon's attack options
    // (they run as this Pokémon's attacks, see UseAttackEffect.delegateFrom).
    if (effect instanceof CheckPokemonAttacksEffect) {
      const player = effect.player;
      if (player.active.getPokemonCard() !== this || IS_ABILITY_BLOCKED(store, state, player, this)) {
        return state;
      }
      player.bench.forEach(b => {
        const benched = b.getPokemonCard();
        if (benched !== undefined) {
          benched.attacks.forEach(attack => {
            effect.attacks.push(attack);
            effect.copiedAttacks.push({ attack, source: benched });
          });
        }
      });
    }

    // Teleportation Burst
    if (effect instanceof AfterAttackEffect && effect.attack === this.attacks[0]) {
      const player = effect.player;
      if (player.bench.some((b) => b.cards.length > 0)) {
        store.prompt(
          state,
          new ConfirmPrompt(player.id, GameMessage.WANT_TO_SWITCH_POKEMON),
          (wantToSwitch) => {
            if (wantToSwitch) {
              SWITCH_ACTIVE_WITH_BENCHED(store, state, player);
            }
          },
        );
      }
    }
    return state;
  }
}
