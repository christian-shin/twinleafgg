import { PokemonCard, Stage, CardType, StoreLike, State, StateUtils } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { MOVE_CARDS, WAS_ATTACK_USED } from '../../../game/store/prefabs/prefabs';
import { OPPONENT_CANNOT_PLAY_CARDS } from '../../../game/store/prefabs/effect-of-attack-prefabs';

// Refs: set-destined-rivals/mow-rotom.ts (discard Stadium), effect-of-attack-prefabs.ts (stadium play lock)
export class ChiYuMEGPool extends PokemonCard {
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [R];
  public hp: number = 110;
  public weakness = [{ type: W }];
  public resistance = [];
  public retreat = [C];

  public attacks = [{
    name: 'Scorching Earth',
    cost: [R],
    damage: 40,
    text: 'If your opponent has a Stadium in play, discard it. If you do, your opponent can\'t play any Stadium cards from their hand during their next turn.'
  }];

  public regulationMark = 'I';
  public set: string = 'MEG';
  public setNumber: string = '31';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Chi-Yu';
  public fullName: string = 'Chi-Yu MEG';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    // Scorching Earth
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const opponent = StateUtils.getOpponent(state, effect.player);
      const stadiumCard = StateUtils.getStadiumCard(state);
      if (stadiumCard === undefined) {
        return state;
      }
      const cardList = StateUtils.findCardList(state, stadiumCard);
      const owner = StateUtils.findOwner(state, cardList);
      if (owner !== opponent) {
        return state;
      }
      MOVE_CARDS(store, state, cardList, owner.discard, { cards: [stadiumCard], sourceCard: this, sourceEffect: this.attacks[0] });
      if (StateUtils.getStadiumCard(state) !== stadiumCard) {
        return OPPONENT_CANNOT_PLAY_CARDS(store, state, effect, this, { stadium: true });
      }
    }
    return state;
  }
}
