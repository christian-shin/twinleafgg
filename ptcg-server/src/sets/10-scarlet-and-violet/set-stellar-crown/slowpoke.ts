import { PokemonCard, Stage, CardType, State, StoreLike, GameMessage, ChooseCardsPrompt, SuperType, StateUtils } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { MOVE_CARDS, SHOW_CARDS_TO_PLAYER, AFTER_ATTACK } from '../../../game/store/prefabs/prefabs';

export class Slowpoke extends PokemonCard {

  public regulationMark = 'H';
  public stage: Stage = Stage.BASIC;
  public cardType: CardType[] = [P];
  public hp: number = 80;
  public weakness = [{ type: D }];
  public resistance = [{ type: F, value: -30 }];
  public retreat = [C, C];

  public attacks = [
    {
      name: 'Dangle Tail',
      cost: [C],
      damage: 0,
      text: 'Put a Pokémon from your discard pile into your hand.'
    },
    {
      name: 'Tackle',
      cost: [P, C],
      damage: 30,
      text: ''
    }
  ];

  public set: string = 'SCR';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '57';
  public name: string = 'Slowpoke';
  public fullName: string = 'Slowpoke SCR';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {

    if (AFTER_ATTACK(effect, 0, this)) {
      const player = effect.player;

      const hasPokemonInDiscard = player.discard.cards.some(c => {
        return c.superType === SuperType.POKEMON;
      });
      // The attack can be used even if the effect can't be carried out (ruling 1790)
      if (!hasPokemonInDiscard) {
        return state;
      }

      return store.prompt(state, [
        new ChooseCardsPrompt(
          player,
          GameMessage.CHOOSE_CARD_TO_HAND,
          player.discard,
          { superType: SuperType.POKEMON },
          { min: 1, max: 1, allowCancel: false }
        )], selected => {
          const cards = selected || [];
          // Cards moving from the discard pile to the hand are revealed (Rulings Compendium, Meta-Rulings)
          SHOW_CARDS_TO_PLAYER(store, state, StateUtils.getOpponent(state, player), cards);
          MOVE_CARDS(store, state, player.discard, player.hand, { cards });
        });
    }

    return state;
  }
}
