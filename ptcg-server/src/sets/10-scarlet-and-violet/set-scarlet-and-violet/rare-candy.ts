import { Card } from '../../../game/store/card/card';
import { CardTarget, PlayerType, SlotType } from '../../../game/store/actions/play-card-action';
import { GameError } from '../../../game/game-error';
import { GameMessage } from '../../../game/game-message';
import { TrainerCard } from '../../../game/store/card/trainer-card';
import { BoardEffect, TrainerType, Stage, SuperType } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { State } from '../../../game/store/state/state';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { ChoosePokemonPrompt } from '../../../game/store/prompts/choose-pokemon-prompt';
import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { CardManager } from '../../../game/cards/card-manager';
import { PokemonCardList } from '../../../game/store/state/pokemon-card-list';
import { CheckPokemonPlayedTurnEffect, CheckSpecialConditionRemovalEffect } from '../../../game/store/effects/check-effects';
import { ChooseCardsPrompt } from '../../../game/store/prompts/choose-cards-prompt';
import { EvolveEffect } from '../../../game/store/effects/game-effects';
import { Player } from '../../../game';
import { MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

// The card database is fixed once loaded, so the Stage 1 list and the
// (Basic name, Stage 1 name) pairs it implies are computed once. (Scanning all
// ~14k cards on every legality check made games with Rare Candy 10x slower.)
let stage1Cache: PokemonCard[] | undefined;
let pairCache: Set<string> | undefined;

function allStage1(): PokemonCard[] {
  if (stage1Cache === undefined) {
    stage1Cache = CardManager.getInstance().getAllCards().filter(c =>
      c instanceof PokemonCard && c.stage === Stage.STAGE_1
    ) as PokemonCard[];
    pairCache = new Set(stage1Cache.map(c => c.evolvesFrom + '\u0000' + c.name));
  }
  return stage1Cache;
}

function isMatchingStage2(stage1: PokemonCard[], basic: PokemonCard, stage2: PokemonCard): boolean {
  if (stage1 === stage1Cache && pairCache !== undefined) {
    return pairCache.has(basic.name + '\u0000' + stage2.evolvesFrom);
  }
  for (const card of stage1) {
    if (card.name === stage2.evolvesFrom && basic.name === card.evolvesFrom) {
      return true;
    }
  }
  return false;
}

function canUseRareCandy(store: StoreLike, state: State, player: Player): boolean {
  // "You can't use this card during your first turn" (a player's first turn is turn 1 or turn 2; ruling 689)
  if (state.turn === 1 || state.turn === 2) {
    return false;
  }
  const stage2 = player.hand.cards.filter(c =>
    c instanceof PokemonCard && c.stage === Stage.STAGE_2
  ) as PokemonCard[];
  // Evolution Jammer (Bronzong TEF): the player can't evolve, so the Stage 2 can't be put onto a Pokémon
  if (stage2.length === 0 || player.cannotEvolvePokemonCards) {
    return false;
  }

  const stage1 = allStage1();

  let hasBasicPokemon = false;
  player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (list, card) => {
    if (card.stage !== Stage.BASIC) {
      return;
    }
    if (!stage2.some(s => isMatchingStage2(stage1, card, s))) {
      return;
    }

    const playedTurnEffect = new CheckPokemonPlayedTurnEffect(player, list);
    store.reduceEffect(state, playedTurnEffect);
    if (playedTurnEffect.pokemonPlayedTurn < state.turn) {
      hasBasicPokemon = true;
    }
  });
  return hasBasicPokemon;
}

function* playCard(next: Function, store: StoreLike, state: State, effect: TrainerEffect): IterableIterator<State> {
  const player = effect.player;

  // Create list of non - Pokemon SP slots
  const blocked: CardTarget[] = [];

  // We will discard this card after prompt confirmation
  effect.preventDefault = true;

  if (!canUseRareCandy(store, state, player)) {
    throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
  }

  const stage2 = player.hand.cards.filter(c => {
    return c instanceof PokemonCard && c.stage === Stage.STAGE_2;
  }) as PokemonCard[];

  // Look through all known cards to find out if it's a valid Stage 2
  const stage1 = allStage1();

  player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (list, card, target) => {
    if (card.stage === Stage.BASIC && stage2.some(s => isMatchingStage2(stage1, card, s))) {
      const playedTurnEffect = new CheckPokemonPlayedTurnEffect(player, list);
      store.reduceEffect(state, playedTurnEffect);
      if (playedTurnEffect.pokemonPlayedTurn < state.turn) {
        return;
      }
    }
    blocked.push(target);
  });

  // We will discard this card after prompt confirmation
  effect.preventDefault = true;

  MOVE_CARDS(store, state, player.hand, player.supporter, { cards: [effect.trainerCard], sourceCard: effect.trainerCard });

  let targets: PokemonCardList[] = [];
  yield store.prompt(state, new ChoosePokemonPrompt(
    player.id,
    GameMessage.CHOOSE_POKEMON_TO_EVOLVE,
    PlayerType.BOTTOM_PLAYER,
    [SlotType.ACTIVE, SlotType.BENCH],
    { allowCancel: false, blocked }
  ), selection => {
    targets = selection || [];
    next();
  });

  if (targets.length === 0) {
    return state; // canceled by user
  }
  const pokemonCard = targets[0].getPokemonCard();
  if (pokemonCard === undefined) {
    return state; // invalid target?
  }

  const blocked2: number[] = [];
  player.hand.cards.forEach((c, index) => {
    if (c instanceof PokemonCard && c.stage === Stage.STAGE_2) {
      if (!isMatchingStage2(stage1, pokemonCard, c)) {
        blocked2.push(index);
      }
    }
  });

  let cards: Card[] = [];
  return store.prompt(state, new ChooseCardsPrompt(
    player,
    GameMessage.CHOOSE_CARD_TO_EVOLVE,
    player.hand,
    { superType: SuperType.POKEMON, stage: Stage.STAGE_2 },
    { min: 1, max: 1, allowCancel: false, blocked: blocked2 }
  ), selected => {
    cards = selected || [];

    if (cards.length > 0) {
      const pokemonCard = cards[0] as PokemonCard;
      const evolveEffect = new EvolveEffect(player, targets[0], pokemonCard);
      store.reduceEffect(state, evolveEffect);

      // This counts as evolving the Pokémon: like a normal evolution it removes its Special
      // Conditions and other effects (ruling 1045; PlayPokemonEffect does the same after EvolveEffect).
      pokemonCard.cannotUseAttackUntilLeavesPlay = undefined;
      pokemonCard.whileInPlayOpponentWeakness = undefined;
      pokemonCard.marker.markers = [];
      const checkRemovalEffect = new CheckSpecialConditionRemovalEffect(player, targets[0]);
      store.reduceEffect(state, checkRemovalEffect);
      targets[0]._preservedConditionsDuringEvolution = checkRemovalEffect.preservedConditions;
      player.removePokemonEffects(targets[0]);
      targets[0]._preservedConditionsDuringEvolution = undefined;
      // Like a normal evolution, Trainer-sourced effects stay (Acerola's Mischief, rulings 1730, 1259)
      targets[0].marker.removeAllExceptTrainerEffects();
      if (targets[0].boardEffect.includes(BoardEffect.ABILITY_USED)) {
        targets[0].removeBoardEffect(BoardEffect.ABILITY_USED);
      }

      // Discard trainer only when user selected a Pokemon

    }
  });
}

export class RareCandy extends TrainerCard {

  public regulationMark = 'G';

  public trainerType: TrainerType = TrainerType.ITEM;

  public set: string = 'SVI';

  public cardImage: string = 'assets/cardback.png';

  public setNumber: string = '191';

  public name: string = 'Rare Candy';

  public fullName: string = 'Rare Candy SVI';

  public text: string =
    'Choose 1 of your Basic Pokemon in play. If you have a Stage 2 card in ' +
    'your hand that evolves from that Pokemon, put that card onto the Basic ' +
    'Pokemon to evolve it. You can\'t use this card during your first turn ' +
    'or on a Basic Pokemon that was put into play this turn.';

  public canPlay(store: StoreLike, state: State, player: Player): boolean {
    return canUseRareCandy(store, state, player);
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const generator = playCard(() => generator.next(), store, state, effect);
      return generator.next().value;
    }

    return state;
  }

}
