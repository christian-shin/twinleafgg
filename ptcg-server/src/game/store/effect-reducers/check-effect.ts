import { GameError } from '../../game-error';
import { GameLog, GameMessage } from '../../game-message';
import { PlayerType, SlotType } from '../actions/play-card-action';
import { EnergyCard } from '../card/energy-card';
import { CardType } from '../card/card-types';
import { PokemonCard } from '../card/pokemon-card';
import { CheckHpEffect, CheckAttackCostEffect, CheckProvidedEnergyEffect, CheckTableStateEffect, CheckRetreatCostEffect, CheckPokemonTypeEffect } from '../effects/check-effects';
import { Effect } from '../effects/effect';
import { KnockOutEffect, MovedToActiveEffect } from '../effects/game-effects';
import { completeKnockOut } from './game-effect';
import { TAKE_SPECIFIC_PRIZES, MOVE_CARDS } from '../prefabs/prefabs';
import { ChoosePokemonPrompt } from '../prompts/choose-pokemon-prompt';
import { ChoosePrizePrompt } from '../prompts/choose-prize-prompt';
import { CoinFlipPrompt } from '../prompts/coin-flip-prompt';
import { ShuffleDeckPrompt } from '../prompts/shuffle-prompt';
import { setupGame, createPlayer } from '../reducers/setup-reducer';
import { CardList } from '../state/card-list';
import { Player } from '../state/player';
import { PokemonCardList } from '../state/pokemon-card-list';
import { StateUtils } from '../state-utils';
import { GamePhase, GameWinner, State } from '../state/state';
import { StoreLike } from '../store-like';

interface PokemonItem {
  playerNum: number;
  cardList: PokemonCardList;
}

interface PrizeGroup {
  destination: CardList;
  count: number;
}

function findKoPokemons(store: StoreLike, state: State): PokemonItem[] {
  const pokemons: PokemonItem[] = [];

  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList, card, target) => {
      const checkHpEffect = new CheckHpEffect(player, cardList);
      store.reduceEffect(state, checkHpEffect);

      if (cardList.damage >= checkHpEffect.hp) {
        pokemons.push({ playerNum: i, cardList });
      }
    });
  }

  return pokemons;
}

//New, Optimized Code ^^ Test Old Code CPU Usage First
// function findKoPokemons(store: StoreLike, state: State): PokemonItem[] {
//   return state.players.reduce((koPokemons: PokemonItem[], player, playerNum) => {
//     player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList, card, target) => {
//       const checkHpEffect = new CheckHpEffect(player, cardList);
//       store.reduceEffect(state, checkHpEffect);

//       if (cardList.damage >= checkHpEffect.hp) {
//         koPokemons.push({ playerNum, cardList });
//       }
//     });
//     return koPokemons;
//   }, []);
// }

// function handleMaxToolsChange(store: StoreLike, state: State): State {
//   state.players.forEach((player, index) => {
//     player.forEachPokemon(PlayerType.ANY, (cardList) => {
//       if (cardList.tools.length > cardList.maxTools) {
//         const amount = cardList.tools.length - cardList.maxTools;
//         REMOVE_TOOLS_FROM_POKEMON_PROMPT(store, state, player, cardList, SlotType.DISCARD, amount, amount);
//       }
//     });
//   });
//   return state;
// }

function handleBenchSizeChange(store: StoreLike, state: State, benchSizes: number[]): State {
  // Skip if we've already handled bench size changes in this state check
  if (state.benchSizeChangeHandled) {
    return state;
  }

  state.players.forEach((player, index) => {
    const benchSize = benchSizes[index];
    // Add empty slots if bench is smaller
    while (player.bench.length < benchSize) {
      const bench = new PokemonCardList();
      bench.isPublic = true;
      player.bench.push(bench);
    }

    if (player.bench.length === benchSize) {
      return;
    }

    // Remove empty slots, starting from the right side
    const empty: PokemonCardList[] = [];
    for (let index = player.bench.length - 1; index >= 0; index--) {
      const bench = player.bench[index];
      const isEmpty = bench.cards.length === 0;
      if (player.bench.length - empty.length > benchSize && isEmpty) {
        empty.push(bench);
      }
    }

    if (player.bench.length - empty.length <= benchSize) {
      // Discarding empty slots is enough
      for (let i = player.bench.length - 1; i >= 0; i--) {
        if (empty.includes(player.bench[i])) {
          player.bench.splice(i, 1);
        }
      }
      return;
    }

    // Player has more Pokemons than bench size, discard some
    const count = player.bench.length - empty.length - benchSize;
    store.prompt(state, new ChoosePokemonPrompt(
      player.id,
      GameMessage.CHOOSE_POKEMON_TO_DISCARD,
      PlayerType.BOTTOM_PLAYER,
      [SlotType.BENCH],
      { min: count, max: count, allowCancel: false }
    ), results => {
      results = results || [];
      const selected = [...empty, ...results];

      // Discard all empty slots and selected Pokemons
      for (let i = player.bench.length - 1; i >= 0; i--) {
        if (selected.includes(player.bench[i])) {
          const cardList = player.bench[i];
          const pokemons = cardList.getPokemons();
          const otherCards = cardList.cards.filter(card =>
            !(card instanceof PokemonCard) &&
            !pokemons.includes(card as PokemonCard) &&
            (!cardList.tools || !cardList.tools.includes(card))
          );
          const tools = [...cardList.tools];

          // Move other cards to discard
          if (otherCards.length > 0) {
            MOVE_CARDS(store, state, cardList, player.discard, { cards: otherCards });
          }

          // Move tools to discard
          for (const tool of tools) {
            cardList.moveCardTo(tool, player.discard);
          }

          // Move Pokémon to discard
          if (pokemons.length > 0) {
            MOVE_CARDS(store, state, cardList, player.discard, { cards: pokemons });
          }
          player.bench.splice(i, 1);
        }
      }
    });
  });
  // Mark that we've handled bench size changes
  state.benchSizeChangeHandled = true;
  return state;
}

function chooseActivePokemons(state: State): ChoosePokemonPrompt[] {
  const prompts: ChoosePokemonPrompt[] = [];

  for (const i of nextTurnPlayerOrder(state)) {
    const player = state.players[i];
    const hasActive = player.active.cards.length > 0;
    const hasBenched = player.bench.some(bench => bench.cards.length > 0);
    if (!hasActive && hasBenched) {
      const choose = new ChoosePokemonPrompt(
        player.id,
        GameMessage.CHOOSE_NEW_ACTIVE_POKEMON,
        PlayerType.BOTTOM_PLAYER,
        [SlotType.BENCH],
        { min: 1, allowCancel: false }
      );
      prompts.push(choose);
    }
  }
  return prompts;
}

function opponentHasNoPokemonInPlay(state: State, takerIndex: number): boolean {
  const opponent = state.players[takerIndex === 0 ? 1 : 0];
  if (opponent.active.cards.length > 0) {
    return false;
  }
  return !opponent.bench.some(bench => bench.cards.length > 0);
}

function autoTakePrizeCards(
  store: StoreLike,
  state: State,
  player: Player,
  count: number,
  destination: CardList
): number {
  const prizesToTake = player.prizes.filter(p => p.cards.length > 0).slice(0, count);
  if (prizesToTake.length === 0) {
    return 0;
  }

  TAKE_SPECIFIC_PRIZES(store, state, player, prizesToTake, {
    destination: destination || player.hand,
    skipReduce: false
  });

  return prizesToTake.length;
}

/**
 * The player whose turn would be next takes Prizes first and promotes a new Active Pokémon first
 * when both have Pokémon Knocked Out at the same time (ruling 754, 757).
 */
function nextTurnPlayerOrder(state: State): number[] {
  const next = state.activePlayer ? 0 : 1;
  return [next, next === 0 ? 1 : 0];
}

/**
 * True when checkWinner would end the game or start a Tiebreaker: a player has no Pokémon in play (an Active spot
 * waiting for a promotion from the Bench does not count) or no Prize cards left.
 */
function winConditionMet(state: State): boolean {
  return state.players.some(player =>
    (player.active.cards.length === 0 && !player.bench.some(b => b.cards.length > 0))
    || player.prizes.every(p => p.cards.length === 0));
}

/**
 * A Knock Out effect at step 2 (Maractus JTG's Explosive Needle) can put counters on a Pokémon that is then Knocked
 * Out in a further round. Every effect has to resolve before the winner is determined, so that round's Knock Outs
 * and Prizes count before the game ends (Rulings 1577, 1584, 1403).
 */
function knockOutPendingBeforeWinner(store: StoreLike, state: State, announced: (PokemonCard | undefined)[]): boolean {
  // A Pokémon whose Knock Out was announced in this round and prevented stays at 0 HP; it is not a new Knock Out.
  return winConditionMet(state)
    && findKoPokemons(store, state).some(ko => !announced.includes(ko.cardList.getPokemonCard()));
}

function choosePrizeCards(store: StoreLike, state: State, prizeGroups: PrizeGroup[][]): ChoosePrizePrompt[] {
  const prompts: ChoosePrizePrompt[] = [];
  let tookLastPrize = false;

  for (const i of nextTurnPlayerOrder(state)) {
    const player = state.players[i];
    for (const group of prizeGroups[i]) {
      const prizeLeft = player.getPrizeLeft();
      // If prizes to take >= remaining prizes, automatically take all prizes. The game does not end here:
      // every effect has to resolve and then all win conditions of both players are counted (checkWinner),
      // e.g. an attacker whose own Knock Out left it without Pokémon also lost (ruling 234, 820, 1403, 1584).
      if (group.count >= prizeLeft && prizeLeft > 0) {
        autoTakePrizeCards(store, state, player, prizeLeft, group.destination || player.hand);
        tookLastPrize = true;
        continue;
      }

      // Last Pokémon in play — take KO prizes without prompting
      if (group.count > 0 && opponentHasNoPokemonInPlay(state, i)) {
        autoTakePrizeCards(store, state, player, group.count, group.destination || player.hand);
        continue;
      }

      if (group.count > prizeLeft) {
        group.count = prizeLeft;
      }
      if (group.count > 0) {
        let message = GameMessage.CHOOSE_PRIZE_CARD;
        // Choose a custom message based on the destination.
        if (group.destination === player.discard) {
          message = GameMessage.CHOOSE_PRIZE_CARD_TO_DISCARD;
        }

        const prompt = new ChoosePrizePrompt(
          player.id,
          message,
          {
            isSecret: player.prizes[0].isSecret,
            count: group.count,
            destination: group.destination
          }
        );
        prompts.push(prompt);
      }
    }
  }
  // A player took the last Prize card: no more Prize prompts
  return tookLastPrize ? [] : prompts;
}

// function choosePrizeCards(state: State, prizesToTake: [number, number]): ChooseCardsPrompt[] {
//   const prompts: ChooseCardsPrompt[] = [];

//   for (let i = 0; i < state.players.length; i++) {
//     const player = state.players[i];
//     const prizeLeft = player.getPrizeLeft();

//     if (prizesToTake[i] > prizeLeft) {
//       prizesToTake[i] = prizeLeft;
//     }

//     if (prizesToTake[i] > 0) {
//       const allPrizeCards = new CardList();
//       // allPrizeCards.isSecret = true;  // Set the CardList as secret
//       // allPrizeCards.isPublic = false;
//       // allPrizeCards.faceUpPrize = false;
//       player.prizes.forEach(prizeList => {
//         allPrizeCards.cards.push(...prizeList.cards);
//       });

//       const prompt = new ChooseCardsPrompt(
//         player,
//         GameMessage.CHOOSE_PRIZE_CARD,
//         allPrizeCards,
//         {},  // No specific filter needed for prizes
//         { min: prizesToTake[i], max: prizesToTake[i], isSecret: player.prizes[0].isSecret, allowCancel: false }
//       );
//       prompts.push(prompt);
//     }
//   }

//   return prompts;
// }


export function endGame(store: StoreLike, state: State, winner: GameWinner): State {

  if (state.players.length !== 2) {
    return state;
  }

  // Allow ending the game during any phase except FINISHED
  if (state.phase === GamePhase.FINISHED) {
    return state;
  }

  switch (winner) {
    case GameWinner.NONE:
      store.log(state, GameLog.LOG_GAME_FINISHED);
      break;
    case GameWinner.DRAW:
      store.log(state, GameLog.LOG_GAME_FINISHED_DRAW);
      break;
    case GameWinner.PLAYER_1:
    case GameWinner.PLAYER_2: {
      const winnerName = winner === GameWinner.PLAYER_1
        ? state.players[0].name
        : state.players[1].name;
      store.log(state, GameLog.LOG_GAME_FINISHED_WINNER, { name: winnerName });
      break;
    }
  }

  state.winner = winner;
  state.phase = GamePhase.FINISHED;
  return state;
}

export function checkWinner(store: StoreLike, state: State, onComplete?: () => void): State {
  const points: [number, number] = [0, 0];
  const reasons: [string[], string[]] = [[], []];

  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];

    // Check for no Pokemon in play (an Active spot waiting for a promotion from the Bench is not a loss)
    if (player.active.cards.length === 0 && !player.bench.some(b => b.cards.length > 0)) {
      store.log(state, GameLog.LOG_PLAYER_NO_ACTIVE_POKEMON, { name: player.name });
      points[i === 0 ? 1 : 0]++;
      reasons[i === 0 ? 1 : 0].push('no_active');
    }

    if (player.prizes.every(p => p.cards.length === 0)) {
      store.log(state, GameLog.LOG_PLAYER_NO_PRIZE_CARD, { name: player.name });
      points[i]++;
      reasons[i].push('no_prizes');
    }
  }

  // Both players met a win condition at the same time: the player who met more of them wins; with the same
  // number of win conditions the game is unresolved and a Sudden Death game is played (ruling 234, 820, 1403)
  if (points[0] > 0 && points[1] > 0 && points[0] === points[1]) {
    return initiateSuddenDeath(store, state);
  }

  if (points[0] + points[1] === 0) {
    // A Tiebreaker game is over as soon as a player has Prize advantage: fewer Prize cards remaining than the
    // opponent, after everything has resolved (rulings 567, 580; Advanced Player's Rulebook I-E)
    if (state.isSuddenDeath) {
      const left = state.players.map(p => p.getPrizeLeft());
      if (left[0] !== left[1]) {
        state = endGame(store, state, left[0] < left[1] ? GameWinner.PLAYER_1 : GameWinner.PLAYER_2);
      }
    }
    if (onComplete) {
      onComplete();
    }
    return state;
  }

  let winner = GameWinner.DRAW;
  if (points[0] > points[1]) {
    winner = GameWinner.PLAYER_1;
  } else if (points[1] > points[0]) {
    winner = GameWinner.PLAYER_2;
  }

  state = endGame(store, state, winner);
  if (onComplete) {
    onComplete();
  }
  return state;
}

/** Fields of a Player that belong to the person, the deck or the cards, not to the game being played. */
const TIEBREAKER_KEPT_PLAYER_FIELDS = [
  'id', 'name', 'deckId', 'sleeveImagePath', 'deckBoxImagePath', 'coinImagePath', 'avatarName', 'deck',
];

/** Instance fields cards write while a game is played that the Tiebreaker game must not inherit. */
const TIEBREAKER_CARD_FLAGS = ['movedToActiveThisTurn', 'extraPrizes', 'strafeUsed', 'discardedStadiumCard'];

/**
 * A Tiebreaker game is a new game (Advanced Player's Rulebook I-E; rulings 234, 820, 1403, 1487): every card goes
 * back to the deck and everything the first game left on the players, the Pokémon slots and the cards is reset.
 */
function initiateSuddenDeath(store: StoreLike, state: State): State {
  store.log(state, GameLog.LOG_SUDDEN_DEATH);

  state.players.forEach(player => {
    // Collect all cards back to deck including tools, the Supporter, stadium, lost zone and any other zones
    [player.active, ...player.bench].forEach(cardList => {
      for (const tool of [...cardList.tools]) {
        cardList.moveCardTo(tool, player.deck);
      }
    });
    [player.active, ...player.bench, player.discard, ...player.prizes, player.hand, player.lostzone, player.stadium, player.supporter]
      .forEach(cardList => cardList.moveTo(player.deck));
    for (const card of player.deck.cards) {
      const flags = card as any;
      for (const flag of TIEBREAKER_CARD_FLAGS) {
        if (flags[flag]) {
          flags[flag] = false;
        }
      }
      if (flags.damageTakenLastTurn) {
        flags.damageTakenLastTurn = 0;
      }
    }

    // A fresh Player for everything else: Pokémon slots, Prize lists, markers, per-turn and per-game flags
    // (damage and Special Conditions on the old Bench slots, prizesTaken, Legacy Energy, turn stamps ...).
    const fresh = createPlayer(player.id, player.name, state.gameSettings?.format);
    for (const key of Object.keys(fresh)) {
      if (!TIEBREAKER_KEPT_PLAYER_FIELDS.includes(key)) {
        (player as any)[key] = (fresh as any)[key];
      }
    }
    for (const key of ['usedRapidStrikeSearchThisTurn', 'usedExcitingStageThisTurn', 'usedSquawkAndSeizeThisTurn',
      'usedTurnSkip', 'usedTableTurner', 'usedMinusCharge', 'usedPlusCharge', 'usedLunarCycle', 'usedRunErrand',
      'usedTributeDance', 'chainsOfControlUsed']) {
      delete (player as any)[key];
    }

    // Shuffle deck
    return store.prompt(state, new ShuffleDeckPrompt(player.id), order => {
      player.deck.applyOrder(order);
    });
  });
  state.lastAttack = null;
  state.playerLastAttack = {};

  // Coin flip for first player
  return store.prompt(state, new CoinFlipPrompt(
    state.players[0].id,
    GameMessage.SETUP_WHO_BEGINS_FLIP
  ), result => {
    const firstPlayer = result ? 0 : 1;
    setupSuddenDeathGame(store, state, firstPlayer);
  });
}

function setupSuddenDeathGame(store: StoreLike, state: State, firstPlayer: number): State {
  state.activePlayer = firstPlayer;
  state.turn = 0;
  state.phase = GamePhase.SETUP;
  state.isSuddenDeath = true;

  const generator = setupGame(() => generator.next(), store, state);
  return generator.next().value;
}

export function* executeCheckState(next: Function, store: StoreLike, state: State, onComplete?: () => void): IterableIterator<State> {
  const prizeGroups: PrizeGroup[][] = state.players.map(() => []);

  // Handle KOs first. Every Knock Out is announced while all Pokémon are still in play, so a Pokémon that
  // is Knocked Out at the same time still has its Ability (Togekiss' Wonder Kiss, ruling 1623); then they
  // leave play and the Prizes are counted.
  const pokemonsToDiscard = findKoPokemons(store, state);
  const announcedKnockOuts: { playerNum: number, knockOutEffect: KnockOutEffect }[] = [];
  const announcedPokemon = pokemonsToDiscard.map(ko => ko.cardList.getPokemonCard());
  for (const pokemonToDiscard of pokemonsToDiscard) {
    const owner = state.players[pokemonToDiscard.playerNum];
    const knockOutEffect = new KnockOutEffect(owner, pokemonToDiscard.cardList);
    knockOutEffect.deferRemoval = true;
    state = store.reduceEffect(state, knockOutEffect);

    if (store.hasPrompts()) {
      yield store.waitPrompt(state, () => next());
    }

    announcedKnockOuts.push({ playerNum: pokemonToDiscard.playerNum, knockOutEffect });
  }

  for (const { playerNum, knockOutEffect } of announcedKnockOuts) {
    if (knockOutEffect.preventDefault === false) {
      state = completeKnockOut(store, state, knockOutEffect);

      if (store.hasPrompts()) {
        yield store.waitPrompt(state, () => next());
      }

      const opponentIndex = playerNum === 0 ? 1 : 0;
      const defaultDestination = state.players[opponentIndex].hand;
      const destination = knockOutEffect.prizeDestination || defaultDestination;

      let group = prizeGroups[opponentIndex].find(g => g.destination === destination);
      if (!group) {
        group = { destination, count: 0 };
        prizeGroups[opponentIndex].push(group);
      }
      // Prize reductions (Legacy Energy, Lillie's Pearl, ...) never go below 0 (ruling 1745)
      group.count += Math.max(0, knockOutEffect.prizeCount);
    }
  }

  // Check table state and handle bench size after KOs
  const checkTableStateEffect = new CheckTableStateEffect([5, 5]);
  store.reduceEffect(state, checkTableStateEffect);
  state.players.forEach(player => {
    player.forEachPokemon(PlayerType.BOTTOM_PLAYER, cardList => {
      if (cardList.cannotBeSpecialConditionedNextTurn && cardList.specialConditions.length > 0) {
        cardList.clearAllSpecialConditions();
      }
    });
  });
  handleBenchSizeChange(store, state, checkTableStateEffect.benchSizes);
  if (store.hasPrompts()) {
    yield store.waitPrompt(state, () => next());
  }

  // Check if the game has ended before proceeding with prompts
  if (state.phase === GamePhase.FINISHED) {
    return state;
  }

  // Handle prize selection first - opponent then player
  const prizePrompts = choosePrizeCards(store, state, prizeGroups);
  for (const prompt of prizePrompts) {
    const player = state.players.find(p => p.id === prompt.playerId);
    if (!player) {
      throw new GameError(GameMessage.ILLEGAL_ACTION);
    }

    state = store.prompt(state, prompt, (result) => {
      const destination: CardList = prompt.options.destination || player.hand;
      TAKE_SPECIFIC_PRIZES(store, state, player, result, { destination });
    });

    if (store.hasPrompts()) {
      yield store.waitPrompt(state, () => next());
    }
  }

  // Last-prize auto-win (or TAKE_X_PRIZES during an attack) must not open Choose Active
  if (state.phase === GamePhase.FINISHED) {
    if (onComplete) {
      onComplete();
    }
    return state;
  }

  // A player has no Prize cards left: the game is decided now (checkWinner counts both players' win
  // conditions) unless both players took their last Prize card at the same time: then the new Active
  // Pokémon are promoted and their effects resolve before the winner is determined (ruling 820, 1584).
  const prizesTaken = state.players.map(p => p.prizes.every(pr => pr.cards.length === 0));
  if (prizesTaken.some(taken => taken) && !prizesTaken.every(taken => taken)) {
    if (knockOutPendingBeforeWinner(store, state, announcedPokemon)) {
      return yield* executeCheckState(next, store, state, onComplete);
    }
    return checkWinner(store, state, onComplete);
  }

  // Then handle new active Pokemon selection - opponent then player
  const activePrompts = chooseActivePokemons(state);
  for (const prompt of activePrompts) {
    const player = state.players.find(p => p.id === prompt.playerId);
    if (!player) {
      throw new GameError(GameMessage.ILLEGAL_ACTION);
    }

    state = store.prompt(state, prompt, (result) => {
      const selectedPokemon = result as PokemonCardList[];
      if (selectedPokemon.length !== 1) {
        throw new GameError(GameMessage.ILLEGAL_ACTION);
      }
      const benchIndex = player.bench.indexOf(selectedPokemon[0]);
      if (benchIndex === -1 || player.active.cards.length > 0) {
        throw new GameError(GameMessage.ILLEGAL_ACTION);
      }
      const temp = player.active;
      player.active = player.bench[benchIndex];
      player.bench[benchIndex] = temp;
      const newActivePokemon = player.active.getPokemonCard();
      if (newActivePokemon) {
        // Add to new tracking system
        if (!player.movedToActiveThisTurn.includes(newActivePokemon.id)) {
          player.movedToActiveThisTurn.push(newActivePokemon.id);
        }
        // Keep existing boolean for backwards compatibility
        newActivePokemon.movedToActiveThisTurn = true;
        // Dispatch MovedToActiveEffect for cards that intercept it
        store.reduceEffect(state, new MovedToActiveEffect(player, newActivePokemon));
      }
    });

    if (store.hasPrompts()) {
      yield store.waitPrompt(state, () => next());
    }
  }

  if (knockOutPendingBeforeWinner(store, state, announcedPokemon)) {
    return yield* executeCheckState(next, store, state, onComplete);
  }

  checkWinner(store, state, onComplete);

  // Reset the bench size change handled flag after all effects are resolved
  state.benchSizeChangeHandled = false;

  return state;
}

export function checkState(store: StoreLike, state: State, onComplete?: () => void): State {
  if ([GamePhase.PLAYER_TURN, GamePhase.ATTACK, GamePhase.BETWEEN_TURNS].includes(state.phase) === false) {
    if (onComplete !== undefined) {
      onComplete();
    }
    return state;
  }
  const generator = executeCheckState(() => generator.next(), store, state, onComplete);
  return generator.next().value;
}

export function checkStateReducer(store: StoreLike, state: State, effect: Effect): State {

  if (effect instanceof CheckAttackCostEffect) {
    const active = effect.player.active;
    const sourceCard = active.attackCostIncreaseWhileActiveSourceCard;
    const sourceOwner = StateUtils.getOpponent(state, effect.player);

    if (sourceCard && sourceOwner.active.getPokemonCard() === sourceCard) {
      const attackCostIncrease = active.attackCostIncreaseWhileActive;
      for (let i = 0; i < attackCostIncrease; i++) {
        effect.cost.push(CardType.COLORLESS);
      }
    } else {
      active.attackCostIncreaseWhileActive = 0;
      active.attackCostIncreaseWhileActiveSourceCard = undefined;
    }

    // "During your opponent's next turn, attacks used by the Defending Pokémon cost [C] more"
    for (let i = 0; i < active.attackCostIncreaseNextTurn; i++) {
      effect.cost.push(CardType.COLORLESS);
    }

    const ignoreTypes = effect.player.ignoreAttackCostCardTypes;
    if (ignoreTypes !== null && effect.player.ignoreAttackCostTurnsRemaining > 0) {
      const checkType = new CheckPokemonTypeEffect(active);
      store.reduceEffect(state, checkType);
      if (ignoreTypes.some(t => checkType.cardTypes.includes(t))) {
        effect.cost = [];
      }
    }

    // A cost that an effect set or ignored is final (see CheckAttackCostEffect.setCost)
    if (effect.setCost !== undefined) {
      effect.cost = [...effect.setCost];
    } else if (effect.ignoreColorless) {
      effect.cost = effect.cost.filter(t => t !== CardType.COLORLESS);
    }
    return state;
  }

  if (effect instanceof CheckRetreatCostEffect) {
    if (effect.player.active.zeroRetreatCostNextTurn || effect.noRetreatCost) {
      effect.cost = [];
    } else {
      for (let i = 0; i < effect.costReduction; i++) {
        const index = effect.cost.indexOf(CardType.COLORLESS);
        if (index === -1) {
          break;
        }
        effect.cost.splice(index, 1);
      }
    }
    return state;
  }

  if (effect instanceof CheckProvidedEnergyEffect) {
    // Check regular energy cards in main cards array
    effect.source.cards.forEach(c => {
      if (c instanceof EnergyCard && !effect.energyMap.some(e => e.card === c)) {
        effect.energyMap.push({ card: c, provides: c.provides });
      }
    });
    // Check Pokemon-as-energy cards in energies CardList
    if (effect.source instanceof PokemonCardList) {
      effect.source.energies.cards.forEach(c => {
        if (!effect.energyMap.some(e => e.card === c)) {
          // For Pokemon-as-energy, the provides property is set by the card itself
          const provides = (c as any).provides || [];
          if (provides.length > 0) {
            effect.energyMap.push({ card: c, provides });
          }
        }
      });
    }
    return state;
  }
  return state;
}
