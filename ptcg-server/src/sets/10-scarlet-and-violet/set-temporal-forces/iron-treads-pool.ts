import {
  PokemonCard, Stage, CardType, CardTag, PowerType, StoreLike, State, StateUtils, AttachEnergyPrompt,
  GameMessage, PlayerType, SlotType, SuperType,
} from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { CheckPokemonTypeEffect } from '../../../game/store/effects/check-effects';
import { AFTER_ATTACK, IS_ABILITY_BLOCKED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

// Refs: set-ancient-origins/golurk.ts (type-changing Ability), set-twilight-masquerade/iron-thorns-ex.ts (move Energy to Bench)
export class IronTreadsTEFPool extends PokemonCard {
  protected _tags = [CardTag.FUTURE];
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [M];
  public hp: number = 130;
  public weakness = [{ type: R }];
  public resistance = [{ type: G, value: -30 }];
  public retreat = [C, C];

  public powers = [{
    name: 'Dual Core',
    powerType: PowerType.ABILITY,
    text: 'As long as this Pokémon has a Future Booster Energy Capsule attached, it is [F] and [M] type.'
  }];

  public attacks = [{
    name: 'Wheel Pass',
    cost: [M, C],
    damage: 60,
    text: 'Move an Energy from this Pokémon to 1 of your Benched Pokémon.'
  }];

  public regulationMark = 'H';
  public set: string = 'TEF';
  public setNumber: string = '118';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Iron Treads';
  public fullName: string = 'Iron Treads TEF';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Dual Core
    if (effect instanceof CheckPokemonTypeEffect && effect.target.getPokemonCard() === this) {
      const hasCapsule = effect.target.tools.some(t => t.name === 'Future Booster Energy Capsule');
      if (!hasCapsule) {
        return state;
      }
      const owner = StateUtils.findOwner(state, effect.target);
      if (IS_ABILITY_BLOCKED(store, state, owner, this)) {
        return state;
      }
      effect.cardTypes = [CardType.FIGHTING, CardType.METAL];
    }

    // Wheel Pass
    if (AFTER_ATTACK(effect, 0, this)) {
      const player = effect.player;
      const source = StateUtils.findCardList(state, this);
      const hasBench = player.bench.some(b => b.cards.length > 0);
      const hasEnergy = source.cards.some(c => c.superType === SuperType.ENERGY);
      if (!hasBench || !hasEnergy || source !== player.active) {
        return state;
      }

      return store.prompt(state, new AttachEnergyPrompt(
        player.id,
        GameMessage.ATTACH_ENERGY_TO_BENCH,
        player.active,
        PlayerType.BOTTOM_PLAYER,
        [SlotType.BENCH],
        { superType: SuperType.ENERGY },
        { allowCancel: false, min: 1, max: 1 }
      ), transfers => {
        for (const transfer of transfers || []) {
          const target = StateUtils.getTarget(state, player, transfer.to);
          MOVE_CARDS(store, state, player.active, target, { cards: [transfer.card], sourceCard: this });
        }
      });
    }
    return state;
  }
}
