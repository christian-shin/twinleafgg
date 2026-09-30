import {
  PokemonCard, Stage, CardType, CardTag, CardTarget, ChoosePokemonPrompt, GameMessage, PlayerType, SlotType,
  StoreLike, State,
} from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { HealEffect } from '../../../game/store/effects/game-effects';
import { WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';

export class ScreamTailTEFPool extends PokemonCard {
  protected _tags = [CardTag.ANCIENT];
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [P];
  public hp: number = 90;
  public weakness = [{ type: D }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C];

  public attacks = [{
    name: 'Supportive Singing',
    cost: [C],
    damage: 0,
    text: 'Heal 100 damage from 1 of your Benched Ancient Pokémon.'
  }, {
    name: 'Hyper Voice',
    cost: [C, C],
    damage: 40,
    text: ''
  }];

  public regulationMark = 'H';
  public set: string = 'TEF';
  public setNumber: string = '77';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Scream Tail';
  public fullName: string = 'Scream Tail TEF';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Supportive Singing
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const player = effect.player;
      const blocked: CardTarget[] = [];
      let hasAncient = false;
      player.bench.forEach((bench, index) => {
        const card = bench.getPokemonCard();
        if (card !== undefined && card.tags.includes(CardTag.ANCIENT)) {
          hasAncient = true;
        } else {
          blocked.push({ player: PlayerType.BOTTOM_PLAYER, slot: SlotType.BENCH, index });
        }
      });
      if (!hasAncient) {
        return state;
      }

      return store.prompt(state, new ChoosePokemonPrompt(
        player.id,
        GameMessage.CHOOSE_POKEMON_TO_HEAL,
        PlayerType.BOTTOM_PLAYER,
        [SlotType.BENCH],
        { min: 1, max: 1, allowCancel: false, blocked }
      ), targets => {
        for (const target of targets || []) {
          const healEffect = new HealEffect(player, target, 100);
          store.reduceEffect(state, healEffect);
        }
      });
    }
    return state;
  }
}
