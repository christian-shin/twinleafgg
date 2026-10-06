import { Action } from './actions/action';
import { Chance } from '../core/chance';
import { OracleHooks } from '../core/oracle-hooks';
import { AbortGameAction } from './actions/abort-game-action';
import { AppendLogAction } from './actions/append-log-action';
import { ConcedeAction } from './actions/concede-action';
import { Card } from './card/card';
import { SuperType, TrainerType } from './card/card-types';
import { TrainerCard } from './card/trainer-card';
import { ChangeAvatarAction } from './actions/change-avatar-action';
import { Effect } from './effects/effect';
import { PlayPokemonEffect, TrainerEffect } from './effects/play-card-effects';
import { CheckAttackCostEffect, CheckPokemonPowersEffect, CheckRetreatCostEffect } from './effects/check-effects';
import { AttackEffect, MovedFromActiveToBenchEffect, MovedToActiveEffect, PowerEffect } from './effects/game-effects';
import { AfterAttackEffect } from './effects/game-phase-effects';
import { CLEAR_TEN_HP_SURVIVORS } from './prefabs/survive-on-ten';
import { BEGIN_LAST_ATTACK } from './prefabs/last-attack';
import {
  CLEAR_ABILITY_LOCK_ACTIVATION,
  STAMP_ABILITY_LOCK_ACTIVATION,
  APPLY_ATTACK_EFFECT_ABILITY_LOCKS,
} from './prefabs/ability-lock';
import { DEFER_UNTIL_AFTER_DAMAGE } from './prefabs/after-damage';
import { isDelegatingCopycat, resolveCopyAttackSessions } from './prefabs/copy-attack-delegation';
import { effectWasBlocked, logAppliedEffect, logPreventedEffect, logResolvedPrompt, stampEffectBlocker } from './prefabs/auto-log';
import { filterTrainerPromptResult, ResolvingTrainerSource } from './prefabs/trainer-target';
import { GameError } from '../game-error';
import { GameMessage, GameLog } from '../game-message';
import { Prompt } from './prompts/prompt';
import { ReorderHandAction, ReorderBenchAction } from './actions/reorder-actions';
import { ResolvePromptAction } from './actions/resolve-prompt-action';
import { State, GamePhase } from './state/state';
import { StateLog, StateLogParam } from './state/state-log';
import { StoreHandler } from './store-handler';
import { StoreLike } from './store-like';
import { generateId, deepClone } from '../../utils/utils';
import { attackReducer } from './effect-reducers/attack-effect';
import { playCardReducer } from './reducers/play-card-reducer';
import { playEnergyReducer } from './effect-reducers/play-energy-effect';
import { playPokemonReducer } from './effect-reducers/play-pokemon-effect';
import { playPokemonFromDeckReducer } from './effect-reducers/play-pokemon-from-deck-effect';
import { playPokemonFromDiscardReducer } from './effect-reducers/play-pokemon-from-discard-effect';
import { playTrainerReducer } from './effect-reducers/play-trainer-effect';
import { playerTurnReducer } from './reducers/player-turn-reducer';
import { gamePhaseReducer } from './effect-reducers/game-phase-effect';
import { gameReducer } from './effect-reducers/game-effect';
import { checkState, checkStateReducer } from './effect-reducers/check-effect';
import { playerStateReducer } from './reducers/player-state-reducer';
import { retreatReducer } from './effect-reducers/retreat-effect';
import { setupPhaseReducer } from './reducers/setup-reducer';
import { abortGameReducer } from './reducers/abort-game-reducer';
import { concedeReducer } from './reducers/concede-reducer';
import { sandboxReducer } from './reducers/sandbox-reducer';
import { SandboxModifyPlayerAction } from './actions/sandbox-modify-player-action';
import { SandboxModifyGameStateAction } from './actions/sandbox-modify-game-state-action';
import { SandboxModifyCardAction } from './actions/sandbox-modify-card-action';
import { SandboxModifyPokemonAction } from './actions/sandbox-modify-pokemon-action';

interface PromptItem {
  ids: number[],
  then: (results: any) => void;
}

function pushAll<T>(out: T[], items: T[]): void {
  for (let i = 0; i < items.length; i++) {
    out.push(items[i]);
  }
}

/**
 * `items` stably sorted by a small integer key: the order Array.prototype.sort
 * (stable) gives, without the comparator calls of a sort on every effect.
 */
function stableSortBy<T>(items: T[], key: (item: T) => number): T[] {
  const keys = new Array<number>(items.length);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < items.length; i++) {
    const k = key(items[i]);
    if (!Number.isInteger(k)) {
      return items.sort((x, y) => key(x) - key(y));
    }
    keys[i] = k;
    if (k < min) min = k;
    if (k > max) max = k;
  }
  if (min === max || items.length < 2) {
    return items;
  }
  if (max - min > 16) {
    return items.sort((x, y) => key(x) - key(y));
  }
  const out: T[] = [];
  for (let k = min; k <= max; k++) {
    for (let i = 0; i < items.length; i++) {
      if (keys[i] === k) {
        out.push(items[i]);
      }
    }
  }
  return out;
}

let overriddenReduceEffect: ((card: Card, format: number) => any) | undefined;

export class Store implements StoreLike {

  //private effectHistory: Effect[] = [];

  public state: State = new State();
  private promptItems: PromptItem[] = [];
  private waitItems: (() => void)[] = [];
  private logId: number = 0;
  // Flag to prevent nested playability calculations
  private calculatingPlayability: boolean = false;
  /** Set only while the played trainer card's own effect (or its prompt callbacks) runs. */
  private resolvingTrainer: ResolvingTrainerSource | undefined;
  /** Prompt ids created by the resolving trainer. Not serialized. */
  private trainerPromptSources = new Map<number, ResolvingTrainerSource>();

  constructor(private handler: StoreHandler) { }

  public dispatch(action: Action, clientRoleId?: number): State {
    let state = this.state;

    // Handle sandbox actions
    if (action instanceof SandboxModifyPlayerAction
      || action instanceof SandboxModifyGameStateAction
      || action instanceof SandboxModifyCardAction
      || action instanceof SandboxModifyPokemonAction) {
      if (clientRoleId === undefined) {
        throw new GameError(GameMessage.ILLEGAL_ACTION);
      }
      state = sandboxReducer(this, state, action, clientRoleId);
      this.handler.onStateChange(state);
      return state;
    }

    if (action instanceof AbortGameAction) {
      state = abortGameReducer(this, state, action);
      this.handler.onStateChange(state);
      return state;
    }

    if (action instanceof ConcedeAction) {
      state = concedeReducer(this, state, action);
      this.handler.onStateChange(state);
      return state;
    }

    if (action instanceof ReorderHandAction
      || action instanceof ReorderBenchAction
      || action instanceof ChangeAvatarAction) {
      state = playerStateReducer(this, state, action);
      this.handler.onStateChange(state);
      return state;
    }

    if (action instanceof ResolvePromptAction) {
      try {
        state = this.reducePrompt(state, action);
      } catch (storeError) {
        this.handler.onStateChange(state);
        throw storeError;
      }
      if (this.promptItems.length === 0) {
        state = checkState(this, state);
      }
      this.handler.onStateChange(state);
      return state;
    }

    if (action instanceof AppendLogAction) {
      this.log(state, action.message, action.params, action.id);
      this.handler.onStateChange(state);
      return state;
    }

    if (state.prompts.some(p => p.result === undefined)) {
      throw new GameError(GameMessage.ACTION_IN_PROGRESS);
    }

    state = this.reduce(state, action);

    return state;
  }

  public reduceEffect(state: State, effect: Effect): State {
    // Energy removed as an effect of an attack waits for the damage (prefabs/after-damage.ts).
    if (DEFER_UNTIL_AFTER_DAMAGE(this, effect)) {
      return state;
    }
    if (effect instanceof AttackEffect) {
      CLEAR_TEN_HP_SURVIVORS();
      BEGIN_LAST_ATTACK(effect);
    }
    if (OracleHooks.onEffect !== undefined) {
      OracleHooks.onEffect(effect);
    }
    // Track Active ability-lock activation order before card handlers run.
    if (effect instanceof MovedToActiveEffect) {
      STAMP_ABILITY_LOCK_ACTIVATION(state, effect.player.active, effect.pokemonCard);
    } else if (effect instanceof MovedFromActiveToBenchEffect) {
      CLEAR_ABILITY_LOCK_ACTIVATION(state, effect.pokemonCard);
    }

    // A copied attack gives the copycat the attack only: source code run for the
    // copycat (delegateToSource) can't use or probe an Ability of the copycat.
    if (effect instanceof PowerEffect && isDelegatingCopycat(effect.card)) {
      throw new GameError(GameMessage.BLOCKED_BY_EFFECT);
    }

    APPLY_ATTACK_EFFECT_ABILITY_LOCKS(state, effect);

    state = this.propagateEffect(state, effect);
    if (!this.calculatingPlayability) {
      logPreventedEffect(this, state, effect);
    }
    state = resolveCopyAttackSessions(this, state, effect);

    const gs = state.gameSettings;
    if (gs?.sandboxMode) {
      if (effect instanceof CheckAttackCostEffect && gs.sandboxAttacksCostNoEnergy) {
        effect.cost = [];
      }
      if (effect instanceof CheckRetreatCostEffect && gs.sandboxRetreatCostsNoEnergy) {
        effect.cost = [];
      }
    }

    if (effect.preventDefault === true) {
      return state;
    }

    state = gamePhaseReducer(this, state, effect);
    state = playEnergyReducer(this, state, effect);
    state = playPokemonReducer(this, state, effect);
    state = playPokemonFromDeckReducer(this, state, effect);
    state = playPokemonFromDiscardReducer(this, state, effect);
    state = playTrainerReducer(this, state, effect);
    state = retreatReducer(this, state, effect);
    state = gameReducer(this, state, effect);
    state = attackReducer(this, state, effect);
    state = checkStateReducer(this, state, effect);
    if (!this.calculatingPlayability) {
      logAppliedEffect(this, state, effect);
    }

    // Calculate playability after all effects are processed
    // The calculatingPlayability flag prevents nested calls during playability checks
    state = this.calculatePlayability(state);

    return state;
  }

  compareEffects(effect1: Effect, effect2: Effect): boolean {
    if (effect1.type !== effect2.type) {
      return false;
    }

    const effect1CardId = (<any>effect1)?.card?.id;
    const effect2CardId = (<any>effect2)?.card?.id;

    const effect1CardPlayerId = (<any>effect1)?.player?.id;
    const effect2CardPlayerId = (<any>effect2)?.player?.id;

    return effect1CardId === effect2CardId &&
      effect1CardPlayerId === effect2CardPlayerId;
  }

  public prompt(state: State, prompts: Prompt<any>[] | Prompt<any>, then: (results: any) => void): State {
    if (!(prompts instanceof Array)) {
      prompts = [prompts];
    }

    for (let i = 0; i < prompts.length; i++) {
      const id = generateId(state.prompts);
      prompts[i].id = id;

      // Route answers to promptController while keeping board perspective on the
      // original owner (Hand Control / forced opponent card play).
      const controllerId = state.promptControllerId;
      if (controllerId !== undefined && controllerId !== prompts[i].playerId) {
        if (prompts[i].perspectivePlayerId === undefined) {
          prompts[i].perspectivePlayerId = prompts[i].playerId;
        }
        prompts[i].playerId = controllerId;
      }

      state.prompts.push(prompts[i]);
      this.stampTrainerPrompt(prompts[i].id);
    }

    const promptItem: PromptItem = {
      ids: prompts.map(prompt => prompt.id),
      then: then
    };

    this.promptItems.push(promptItem);
    return state;
  }

  public waitPrompt(state: State, callback: () => void): State {
    this.waitItems.push(callback);
    return state;
  }

  public log(state: State, message: GameLog, params?: StateLogParam, client?: number): void {
    // Oracle trials / look-ahead are rolled back, and nothing reads state.logs,
    // so skip building log entries (the locale timestamp is costly) while simulating.
    if (Chance.inSim) {
      return;
    }
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).toString();

    const log = new StateLog(message, params, client);
    log.params = { ...params, timestamp };
    log.id = ++this.logId;
    state.logs.push(log);
  }

  private reducePrompt(state: State, action: ResolvePromptAction): State {
    // Resolve prompts actions
    const prompt = state.prompts.find(item => item.id === action.id);
    const promptItem = this.promptItems.find(item => item.ids.indexOf(action.id) !== -1);

    if (prompt === undefined || promptItem === undefined) {
      return state;
    }

    if (prompt.result !== undefined) {
      throw new GameError(GameMessage.PROMPT_ALREADY_RESOLVED);
    }

    try {
      prompt.result = action.result;

      if (action.log !== undefined) {
        this.log(state, action.log.message, action.log.params, action.log.client);
      }

      const pending = promptItem.ids.map(id => {
        const p = state.prompts.find(item => item.id === id);
        return p === undefined ? undefined : p.result;
      });

      if (pending.every(result => result !== undefined)) {
        this.applyTrainerTargetFilters(state, promptItem.ids);
        if (!this.calculatingPlayability) {
          for (const id of promptItem.ids) {
            const resolved = state.prompts.find(item => item.id === id);
            if (resolved) {
              logResolvedPrompt(this, state, resolved);
            }
          }
        }
        const results = promptItem.ids.map(id => {
          const p = state.prompts.find(item => item.id === id);
          return p === undefined ? undefined : p.result;
        });
        const source = this.takeTrainerPromptSource(promptItem.ids);
        const previous = this.resolvingTrainer;
        if (source) {
          this.resolvingTrainer = source;
        }
        try {
          const itemIndex = this.promptItems.indexOf(promptItem);
          promptItem.then(results.length === 1 ? results[0] : results);
          this.promptItems.splice(itemIndex, 1);
        } finally {
          this.resolvingTrainer = previous;
        }
      }

      this.resolveWaitItems();
    } catch (storeError) {
      this.dropTrainerPromptSources(promptItem.ids);
      for (const id of promptItem.ids) {
        const promptIndex = state.prompts.findIndex(item => item.id === id);
        if (promptIndex !== -1) {
          state.prompts.splice(promptIndex, 1);
        }
      }
      const itemIndex = this.promptItems.indexOf(promptItem);
      if (itemIndex !== -1) {
        this.promptItems.splice(itemIndex, 1);
      }
      throw storeError;
    }

    return state;
  }

  private resolveWaitItems(): void {
    while (this.promptItems.length === 0 && this.waitItems.length > 0) {
      const waitItem = this.waitItems.pop();
      if (waitItem !== undefined) {
        waitItem();
      }
    }
  }

  public hasPrompts(): boolean {
    return this.promptItems.length > 0;
  }

  public cleanup(): void {
    this.promptItems = [];
    this.waitItems = [];
    this.logId = 0;
    this.state = new State();
  }

  private reduce(state: State, action: Action): State {
    const stateBackup = OracleHooks.noBackup ? state : deepClone(state, [Card]);
    this.promptItems.length = 0;

    try {
      state = setupPhaseReducer(this, state, action);
      state = playCardReducer(this, state, action);
      state = playerTurnReducer(this, state, action);

      this.resolveWaitItems();
      if (this.promptItems.length === 0) {
        state = checkState(this, state);
      }

      // Calculate playability before state change
      state = this.calculatePlayability(state);
    } catch (storeError) {
      // Illegal action
      this.state = stateBackup;
      this.promptItems.length = 0;
      throw storeError;
    }

    this.handler.onStateChange(state);
    return state;
  }

  private calculatePlayability(state: State): State {
    // Prevent nested calls - if we're already calculating playability, skip
    if (this.calculatingPlayability) {
      return state;
    }

    if (OracleHooks.noPlayability) {
      return state;
    }

    // Skip playability calculation during setup and other non-play phases
    // Only calculate starting from Turn 1 (skip Turn 0 which is setup)
    if (state.phase !== GamePhase.PLAYER_TURN || state.turn < 1) {
      // Clear playability for all players when not in player turn or during setup
      for (const player of state.players) {
        player.playableCardIds = [];
        player.playableHandAbilityCardIds = [];
      }
      return state;
    }

    // Skip if players aren't set up yet
    if (!state.players || state.players.length === 0) {
      return state;
    }

    // Set flag to prevent nested calls
    this.calculatingPlayability = true;
    Chance.enterSim();

    // Track prompts before playability check to clean up any created during checks
    const promptItemsBefore = this.promptItems.length;
    const waitItemsBefore = this.waitItems.length;

    try {
      const { CAN_PLAY_CARD, CAN_USE_FROM_HAND_TO_BENCH_POWER } = require('./prefabs/prefabs');
      const { PokemonCard } = require('./card/pokemon-card');

      for (const player of state.players) {
        // Clear previous playability
        player.playableCardIds = [];
        player.playableHandAbilityCardIds = [];

        // Only calculate for the active player
        if (state.players[state.activePlayer]?.id !== player.id) {
          continue;
        }

        // Check each card in hand
        for (const card of player.hand.cards) {
          try {
            // Skip cards without valid IDs (shouldn't happen, but safety check)
            if (card.id === undefined || card.id === -1) {
              continue;
            }

            if (CAN_PLAY_CARD(this, state, player, card)) {
              player.playableCardIds.push(card.id);
            }
            if (
              card instanceof PokemonCard &&
              CAN_USE_FROM_HAND_TO_BENCH_POWER(this, state, player, card)
            ) {
              player.playableHandAbilityCardIds.push(card.id);
            }
          } catch (error) {
            // If check fails, card is not playable - silently continue
          }
        }
      }
    } catch (error) {
      // If playability calculation fails entirely, just clear all and continue
      // This prevents setup from breaking
      for (const player of state.players) {
        player.playableCardIds = [];
        player.playableHandAbilityCardIds = [];
      }
    } finally {
      // Clean up any prompts or wait items that were created during playability checks
      // These are fake prompts from testing card playability and should not interfere with real game prompts
      if (this.promptItems.length > promptItemsBefore) {
        const removed = this.promptItems.splice(promptItemsBefore, this.promptItems.length - promptItemsBefore);
        for (const item of removed) {
          this.dropTrainerPromptSources(item.ids);
        }
      }
      if (this.waitItems.length > waitItemsBefore) {
        this.waitItems.splice(waitItemsBefore, this.waitItems.length - waitItemsBefore);
      }
      // Always clear the flag, even if an error occurred
      this.calculatingPlayability = false;
      Chance.exitSim();
    }

    return state;
  }

  private propagateEffect(state: State, effect: Effect): State {
    let cards: Card[] = [];
    for (const player of state.players) {
      pushAll(cards, player.stadium.cards);
      pushAll(cards, player.supporter.cards);
      pushAll(cards, player.active.cards);
      pushAll(cards, player.active.tools);
      for (const bench of player.bench) {
        pushAll(cards, bench.cards);
        pushAll(cards, bench.tools);
      }
      for (const prize of player.prizes) {
        pushAll(cards, prize.cards);
      }
      pushAll(cards, player.hand.cards);
      pushAll(cards, player.deck.cards);
      pushAll(cards, player.discard.cards);
    }
    const playPokemonTargetTools = effect instanceof PlayPokemonEffect
      ? effect.target.tools.slice()
      : [];

    playPokemonTargetTools.forEach(t => {
      state = this.callReduceEffect(t, this, state, effect);
    });

    // Ability locks live on Trainers/Stadiums.
    // PowerEffect: run lockers first so they throw before ability owners mutate state.
    // CheckPokemonPowersEffect: run stadiums last so filters apply after tools / BREAK /
    // LV.X handlers contribute powers (otherwise Path to the Peak etc. get undone).
    if (effect instanceof PowerEffect) {
      const rank = (c: Card) => {
        if (c.superType === SuperType.TRAINER) return 0;
        if (c.superType === SuperType.ENERGY) return 1;
        return 2;
      };
      cards = stableSortBy(cards, rank);
    } else if (effect instanceof CheckPokemonPowersEffect) {
      const rank = (c: Card) => {
        if (c.superType === SuperType.POKEMON) return 0;
        if (c.superType === SuperType.ENERGY) return 1;
        if (c instanceof TrainerCard && c.trainerType === TrainerType.STADIUM) return 3;
        if (c.superType === SuperType.TRAINER) return 2;
        return 2;
      };
      cards = stableSortBy(cards, rank);
    } else if (effect instanceof AfterAttackEffect) {
      // Pokémon (the attack's own effects), then Energy (Boomerang Energy re-attaches), then Trainers
      // (Handheld Fan moves an Energy off the attacker): the triggered effects of the Defending Pokémon
      // resolve after everything the attack did (ruling 1625, 1650).
      const rank = (c: Card) => {
        if (c.superType === SuperType.POKEMON) return 0;
        if (c.superType === SuperType.ENERGY) return 1;
        return 2;
      };
      cards = stableSortBy(cards, rank);
    } else {
      cards = stableSortBy(cards, c => c.superType);
    }
    cards.forEach(c => {
      if (playPokemonTargetTools.includes(c)) {
        return;
      }
      state = this.callReduceEffect(c, this, state, effect);
    });
    return state;
  }

  // Utility function to call reduceEffect with override support
  private callReduceEffect(card: Card, store: StoreLike, state: State, effect: Effect): State {
    const resolvingThisTrainer = !this.calculatingPlayability
      && effect instanceof TrainerEffect
      && effect.trainerCard === card;
    const previous = this.resolvingTrainer;
    if (resolvingThisTrainer && effect instanceof TrainerEffect) {
      this.resolvingTrainer = { player: effect.player, trainerCard: effect.trainerCard };
    }

    const alreadyBlocked = effectWasBlocked(effect);

    if (OracleHooks.beforeCardReduce !== undefined) {
      OracleHooks.beforeCardReduce(card, effect);
    }
    try {
      // Only try override for TrainerCard (for now)
      if ((card as any).trainerType !== undefined) {
        // Loaded on first use to avoid a circular dependency at module level
        // (cached: require() resolves the path on every call).
        if (overriddenReduceEffect === undefined) {
          overriddenReduceEffect = require('./card/card-effect-overrides').getOverriddenReduceEffect;
        }
        const getOverriddenReduceEffect = overriddenReduceEffect!;
        const format = (store as any)?.handler?.gameSettings?.format ?? 0;
        const override = getOverriddenReduceEffect(card, format);
        if (override) {
          return override(store, state, effect);
        }
      }
      return card.reduceEffect(store, state, effect);
    } finally {
      stampEffectBlocker(effect, card, alreadyBlocked);
      if (OracleHooks.afterCardReduce !== undefined) {
        OracleHooks.afterCardReduce(card, effect);
      }
      if (resolvingThisTrainer) {
        this.resolvingTrainer = previous;
      }
    }
  }

  private stampTrainerPrompt(promptId: number): void {
    if (this.calculatingPlayability || this.resolvingTrainer === undefined) {
      return;
    }
    this.trainerPromptSources.set(promptId, this.resolvingTrainer);
  }

  private applyTrainerTargetFilters(state: State, promptIds: number[]): void {
    for (const id of promptIds) {
      const prompt = state.prompts.find(item => item.id === id);
      const source = this.trainerPromptSources.get(id);
      if (prompt === undefined || source === undefined) {
        continue;
      }
      filterTrainerPromptResult(this, state, prompt, source);
    }
  }

  private takeTrainerPromptSource(promptIds: number[]): ResolvingTrainerSource | undefined {
    let source: ResolvingTrainerSource | undefined;
    for (const id of promptIds) {
      const stamped = this.trainerPromptSources.get(id);
      if (stamped) {
        source = stamped;
      }
      this.trainerPromptSources.delete(id);
    }
    return source;
  }

  private dropTrainerPromptSources(promptIds: number[]): void {
    for (const id of promptIds) {
      this.trainerPromptSources.delete(id);
    }
  }
}