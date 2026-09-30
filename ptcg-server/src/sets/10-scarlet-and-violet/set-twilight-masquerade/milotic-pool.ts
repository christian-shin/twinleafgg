import { PokemonCard, Stage, CardType, PowerType, PlayerType, PokemonCardList, StoreLike, State, StateUtils } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { MoveCardsEffect } from '../../../game/store/effects/game-effects';
import { IS_ABILITY_BLOCKED } from '../../../game/store/prefabs/prefabs';

// Ref: set-paradox-rift/toedscruel.ts (passive Ability preventing cards from being put into a hand)
export class MiloticTWMPool extends PokemonCard {
  public stage: Stage = Stage.STAGE_1;
  public evolvesFrom: string = 'Feebas';
  public cardType: CardType[] = [W];
  public hp: number = 120;
  public weakness = [{ type: L }];
  public resistance = [];
  public retreat = [C];

  public powers = [{
    name: 'Mentally Calm',
    powerType: PowerType.ABILITY,
    text: 'Your opponent\'s Pokémon in play and all attached cards can\'t be put into your opponent\'s hand.'
  }];

  public attacks = [{
    name: 'Hydro Splash',
    cost: [W, C, C],
    damage: 100,
    text: ''
  }];

  public regulationMark = 'H';
  public set: string = 'TWM';
  public setNumber: string = '50';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Milotic';
  public fullName: string = 'Milotic TWM';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Mentally Calm
    if (effect instanceof MoveCardsEffect && effect.source instanceof PokemonCardList) {
      let owner;
      try {
        const myList = StateUtils.findCardList(state, this);
        if (!(myList instanceof PokemonCardList) || myList.getPokemonCard() !== this) {
          return state;
        }
        owner = StateUtils.findOwner(state, myList);
      } catch {
        return state;
      }
      const opponent = StateUtils.getOpponent(state, owner);
      if (effect.destination !== opponent.hand) {
        return state;
      }

      let fromOpponentsPlay = false;
      opponent.forEachPokemon(PlayerType.BOTTOM_PLAYER, cardList => {
        if (cardList === effect.source) {
          fromOpponentsPlay = true;
        }
      });
      if (!fromOpponentsPlay) {
        return state;
      }

      if (IS_ABILITY_BLOCKED(store, state, owner, this)) {
        return state;
      }

      effect.preventDefault = true;
    }
    return state;
  }
}
