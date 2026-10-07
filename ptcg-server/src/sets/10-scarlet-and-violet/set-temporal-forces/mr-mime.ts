import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { Stage, CardType, SuperType, TrainerType, SpecialCondition } from '../../../game/store/card/card-types';
import { StoreLike, State, StateUtils, PokemonCardList, GameError, GameMessage, ChooseCardsPrompt, TrainerCard } from '../../../game';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';

import { AddSpecialConditionsEffect } from '../../../game/store/effects/attack-effects';
import { WAS_ATTACK_USED, AFTER_ATTACK } from '../../../game/store/prefabs/prefabs';

export class MrMime extends PokemonCard {

  public stage: Stage = Stage.BASIC;

  public cardType: CardType[] = [CardType.PSYCHIC];

  public hp: number = 90;

  public weakness = [{ type: CardType.DARK }];

  public resistance = [{ type: CardType.FIGHTING, value: -30 }];

  public retreat = [CardType.COLORLESS];

  public attacks =
    [
      {
        name: 'Look-Alike Show',
        cost: [CardType.COLORLESS],
        damage: 0,
        text: 'Your opponent reveals their hand. You may use the effect of a Supporter card you find there as the effect of this attack.'
      },
      {
        name: 'Eerie Wave',
        cost: [CardType.PSYCHIC],
        damage: 20,
        text: 'Your opponent\'s Active Pokémon is now Confused.'
      }
    ];

  public set: string = 'TEF';

  public regulationMark = 'H';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '63';

  public name: string = 'Mr. Mime';

  public fullName: string = 'Mr. Mime TEF';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {

    if (WAS_ATTACK_USED(effect, 0, this)) {
      const cardList = StateUtils.findCardList(state, this) as PokemonCardList;

      if (cardList !== effect.player.active) {
        throw new GameError(GameMessage.CANNOT_USE_POWER);
      }
    }

    if (AFTER_ATTACK(effect, 0, this)) {
      const player = effect.player;
      const opponent = StateUtils.getOpponent(state, player);

      const chooseSupporter = (blocked: number[]): State => store.prompt(state, new ChooseCardsPrompt(
        player,
        GameMessage.CHOOSE_CARD_TO_COPY_EFFECT,
        opponent.hand,
        { superType: SuperType.TRAINER, trainerType: TrainerType.SUPPORTER },
        { allowCancel: false, min: 0, max: 1, blocked }
      ), cards => {
        if (cards === null || cards.length === 0) {
          return;
        }
        const trainerCard = cards[0] as TrainerCard;
        // Using the effect of a Supporter is not playing it: a Supporter already played this turn doesn't stop it.
        const supporterTurn = player.supporterTurn;
        player.supporterTurn = 0;
        try {
          const playTrainerEffect = new TrainerEffect(player, trainerCard);
          playTrainerEffect.usedAsAttackEffect = true;
          playTrainerEffect.usedAsAttackEffect = true;
          store.reduceEffect(state, playTrainerEffect);
        } catch (error) {
          if (!(error instanceof GameError)) {
            throw error;
          }
          // The effect of this Supporter can't be used right now: choose another one.
          chooseSupporter([...blocked, opponent.hand.cards.indexOf(trainerCard)]);
        } finally {
          player.supporterTurn = supporterTurn;
        }
      });
      return chooseSupporter([]);
    }

    if (WAS_ATTACK_USED(effect, 1, this)) {
      const specialConditionEffect = new AddSpecialConditionsEffect(effect, [SpecialCondition.CONFUSED]);
      store.reduceEffect(state, specialConditionEffect);
    }
    return state;
  }
}
