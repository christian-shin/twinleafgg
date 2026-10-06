import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { DiscardCardsEffect } from '../../../game/store/effects/attack-effects';
import { Stage, CardType, SuperType, TrainerType } from '../../../game/store/card/card-types';
import { StoreLike, State, GameMessage, PlayerType, SlotType, StateUtils } from '../../../game';
import { DiscardEnergyPrompt, DiscardEnergyTransfer } from '../../../game/store/prompts/discard-energy-prompt';
import { AttackEffect } from '../../../game/store/effects/game-effects';
import { Effect } from '../../../game/store/effects/effect';
import {WAS_ATTACK_USED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

function* useCleaningUp(next: Function, store: StoreLike, state: State,
  effect: AttackEffect): IterableIterator<State> {
  const player = effect.player;
  const opponent = StateUtils.getOpponent(state, player);

  let toolsInPlay = 0;
  opponent.forEachPokemon(PlayerType.TOP_PLAYER, (cardList) => {
    toolsInPlay += cardList.tools.length;
  });

  // The attack can be used even if there is no Tool to discard; it then does nothing.
  if (toolsInPlay === 0) {
    return state;
  }

  // We will discard this card after prompt confirmation
  effect.preventDefault = true;

  // "Discard up to 2 Pokémon Tools": the choice is over the Tools (an attack: 0 is allowed, ruling 1721)
  let transfers: DiscardEnergyTransfer[] = [];
  yield store.prompt(state, new DiscardEnergyPrompt(
    player.id,
    GameMessage.CHOOSE_CARD_TO_DISCARD,
    PlayerType.TOP_PLAYER,
    [SlotType.ACTIVE, SlotType.BENCH],
    { superType: SuperType.TRAINER, trainerType: TrainerType.TOOL },
    { min: 0, max: Math.min(2, toolsInPlay), allowCancel: false }
  ), results => {
    transfers = results || [];
    next();
  });

  transfers.forEach(transfer => {
    const target = StateUtils.getTarget(state, player, transfer.from);
    const owner = StateUtils.findOwner(state, target);
    // An effect of the attack on that Pokémon: Mist Energy and the like prevent it (a probe without cards, ruling 1843)
    const probe = new DiscardCardsEffect(effect, []);
    probe.target = target;
    store.reduceEffect(state, probe);
    if (probe.preventDefault) {
      return;
    }
    MOVE_CARDS(store, state, target, owner.discard, { cards: [transfer.card], sourceCard: effect.source.getPokemonCard()! });
  });

  return state;
}

export class Minccino extends PokemonCard {

  public regulationMark = 'H';

  public stage: Stage = Stage.BASIC;

  public cardType: CardType[] = [CardType.COLORLESS];

  public hp: number = 70;

  public weakness = [{ type: CardType.FIGHTING }];

  public retreat = [CardType.COLORLESS];

  public attacks = [
    {
      name: 'Beat',
      cost: [CardType.COLORLESS],
      damage: 10,
      text: ''
    },
    {
      name: 'Cleaning Up',
      cost: [CardType.COLORLESS, CardType.COLORLESS],
      damage: 0,
      text: 'Discard up to 2 Pokémon Tools from your opponent\'s Pokémon.'
    }
  ];

  public set: string = 'TEF';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '136';

  public name: string = 'Minccino';

  public fullName: string = 'Minccino TEF';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (WAS_ATTACK_USED(effect, 1, this)) {
      const generator = useCleaningUp(() => generator.next(), store, state, effect);
      return generator.next().value;
    }

    return state;
  }

}
