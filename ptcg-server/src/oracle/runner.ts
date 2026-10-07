/**
 * Headless deterministic game runner (PLAN.md 4.1 steps 3–7).
 *
 * Plays one game from two decklists and a seed with a driver policy and
 * records a trace: every decision with its full option set, the chosen
 * answer, the chance outcomes consumed before the next decision, the effect
 * types propagated, and the canonical state hash at the next decision.
 */
import { Store } from '../game/store/store';
import { StoreHandler } from '../game/store/store-handler';
import { State, GamePhase } from '../game/store/state/state';
import { AddPlayerAction } from '../game/store/actions/add-player-action';
import { ResolvePromptAction } from '../game/store/actions/resolve-prompt-action';
import { Prompt } from '../game/store/prompts/prompt';
import { GameMessage } from '../game/game-message';
import { ShuffleDeckPrompt } from '../game/store/prompts/shuffle-prompt';
import { CoinFlipPrompt } from '../game/store/prompts/coin-flip-prompt';
import { ShufflePrizesPrompt } from '../game/store/prompts/shuffle-prizes-prompt';
import { ShuffleHandPrompt } from '../game/store/prompts/shuffle-hand-prompt';
import { GameSettings } from '../game/core/game-settings';
import { Chance, ChanceEvent, Rng } from '../game/core/chance';
import { OracleHooks } from '../game/core/oracle-hooks';
import { Player } from '../game/store/state/player';
import { PlayCardAction } from '../game/store/actions/play-card-action';
import { Snapshot, withRollback } from './rollback';
import { canonicalState, stableStringify, fnv1a64 } from './canonical';
import {
  classifyPrompt, describePrompt, decodeAnswer, randomAnswer, infoAnswer, encodeAnswer,
  turnCandidates, describeAction, playerIndex, TurnOption,
} from './options';
import { SimpleTacticsAi } from '../simple-bot/simple-tactics-ai';
import {
  allSimpleTactics, allPromptResolvers, defaultStateScores, defaultArbiterOptions,
} from '../simple-bot/simple-bot-definitions';
import { loadAllCards } from './load-cards';
import { Scenario, applyScenario, scenarioTurn } from './scenario';
import { oracleCopyAttackSessions } from '../game/store/prefabs/copy-attack-delegation';

export const PLAYER_IDS = [1, 2];

export type PolicyName = 'random' | 'bot' | string; // 'mix:0.2' = bot with 20% random

export interface RunOptions {
  seed: number;
  decks: [string[], string[]];
  policy: [PolicyName, PolicyName];
  maxSteps?: number;
  maxTurns?: number;
  /** Record effect types per step. */
  effects?: boolean;
  /** Keep the full canonical JSON at each step (debugging). */
  keepStates?: boolean;
  /** Replay these answers instead of consulting a policy. */
  answers?: any[];
  /** Board edits applied at the first turn decision on or after `scenario.turn` (scenario.ts). */
  scenario?: Scenario;
}

export interface TraceStep {
  i: number;
  /** Deciding player index (0/1). */
  p: number;
  /** Decision descriptor: a prompt, or `{ kind: 'turn', options }`. */
  d: any;
  /** Answer: raw prompt result, or the chosen option descriptor for turns. */
  a: any;
  /** Chance outcomes consumed after the answer, before the next decision. */
  c: ChanceEvent[];
  /** Canonical state hash at the next decision (or at game end). */
  h: string;
  /** Effect types propagated while resolving this step. */
  e?: string[];
  s?: any;
}

export interface Trace {
  header: {
    seed: number;
    decks: [string[], string[]];
    policy: [string, string];
    twinleaf: string;
    scenario?: Scenario;
  };
  /** Chance consumed and hash reached before the first decision. */
  start: { c: ChanceEvent[]; h: string; e?: string[]; s?: any };
  steps: TraceStep[];
  /** Where the scenario edits were applied: before step `step`, giving hash `h`. */
  scenario?: { step: number; h: string };
  result: {
    status: 'finished' | 'cap' | 'stuck' | 'error';
    winner: number;
    turn: number;
    message?: string;
    strayRandom: number;
    botOffList: number;
  };
}

export const TWINLEAF_COMMIT = '41382b8141f90eb59d0c2ec982886e26d452a0ff+oracle';

class NullHandler implements StoreHandler {
  public onStateChange(state: State): void { }
}

function botFor(playerId: number): SimpleTacticsAi {
  const options = {
    tactics: allSimpleTactics,
    promptResolvers: allPromptResolvers,
    scores: defaultStateScores,
    arbiter: defaultArbiterOptions,
  };
  return new SimpleTacticsAi({ id: playerId } as any, options as any, null);
}

export class GameRunner {
  public store: Store;
  private policyRng: Rng;
  private bots: SimpleTacticsAi[];
  private effectLog: string[] = [];
  private botOffList = 0;
  private answerCursor = 0;
  /** Scripted decisions from a scenario, used before the policy. */
  private script: any[] = [];

  constructor(public opts: RunOptions) {
    loadAllCards();
    Chance.reset(opts.seed);
    this.policyRng = new Rng((opts.seed * 2654435761) >>> 0);
    this.store = new Store(new NullHandler());
    const settings = new GameSettings();
    settings.recordingEnabled = false;
    this.store.state.gameSettings = settings;
    this.store.state.rules = settings.rules;
    this.bots = PLAYER_IDS.map(id => botFor(id));
    OracleHooks.noBackup = true;
    OracleHooks.noPlayability = true;
    OracleHooks.onEffect = opts.effects ? (effect: any) => {
      if (!Chance.inSim) {
        this.effectLog.push(effect.type);
      }
    } : undefined;
  }

  get state(): State {
    return this.store.state;
  }

  /** Resolve chance and info prompts until a decision or the end of the game. */
  private settle(): void {
    for (let guard = 0; guard < 10000; guard++) {
      const state = this.state;
      if (state.phase === GamePhase.FINISHED) {
        return;
      }
      const pending = state.prompts.filter(p => p.result === undefined);
      const auto = pending.find(p => classifyPrompt(p) !== 'decision');
      if (auto === undefined) {
        return;
      }
      let result: any;
      if (classifyPrompt(auto) === 'chance') {
        result = this.chanceAnswer(state, auto);
      } else {
        result = infoAnswer(auto);
      }
      this.store.dispatch(new ResolvePromptAction(auto.id, result));
    }
    throw new Error('settle: too many automatic prompts');
  }

  private chanceAnswer(state: State, prompt: Prompt<any>): any {
    const owner = state.players.find(p => p.id === prompt.getPerspectivePlayerId())!;
    if (prompt instanceof ShuffleDeckPrompt) {
      return Chance.shuffle(owner.deck.cards.length);
    }
    if (prompt instanceof CoinFlipPrompt) {
      return Chance.coin();
    }
    if (prompt instanceof ShufflePrizesPrompt) {
      return Chance.shuffle(owner.prizes.reduce((n, l) => n + l.cards.length, 0));
    }
    if (prompt instanceof ShuffleHandPrompt) {
      return Chance.shuffle(owner.prizes.length);
    }
    throw new Error('unknown chance prompt ' + prompt.type);
  }

  private takeChance(): ChanceEvent[] {
    const c = Chance.events;
    Chance.events = [];
    return c;
  }

  private takeEffects(): string[] | undefined {
    if (!this.opts.effects) {
      return undefined;
    }
    const e = this.effectLog;
    this.effectLog = [];
    return e;
  }

  private canonical(): { h: string, s?: any } {
    const json = stableStringify(canonicalState(this.state));
    return { h: fnv1a64(json), s: this.opts.keepStates ? JSON.parse(json) : undefined };
  }

  /** Legal turn options for the active player, by trial dispatch. */
  public legalTurnOptions(player: Player): TurnOption[] {
    const store = this.store;
    // One snapshot serves the candidate enumeration and every trial: after a
    // restore the graph is exactly what the snapshot recorded.
    const snap = new Snapshot([store, oracleCopyAttackSessions()]);
    let candidates: TurnOption[];
    try {
      candidates = Chance.sim(() => turnCandidates(store, store.state, player));
    } finally {
      snap.restore();
    }
    const seen = new Set<string>();
    const legal: TurnOption[] = [];
    for (const cand of candidates) {
      const key = stableStringify(cand.desc);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      let ok = true;
      try {
        Chance.trial(() => {
          store.dispatch(cand.action);
          // Resolve info prompts (e.g. an ability's animation wait) so checks
          // that run after them count toward legality; stop at chance/decisions.
          // The one exception is the Confusion flip: its heads branch runs the
          // attack, so it is resolved as heads (a Confused attacker must not be
          // offered an attack that throws once the flip succeeds).
          for (let guard = 0; guard < 100; guard++) {
            const next = store.state.prompts.find(p => p.result === undefined && classifyPrompt(p) !== 'decision');
            if (next === undefined || store.state.phase === GamePhase.FINISHED) {
              break;
            }
            if (classifyPrompt(next) === 'info') {
              store.dispatch(new ResolvePromptAction(next.id, infoAnswer(next)));
            } else if (next instanceof CoinFlipPrompt && next.message === GameMessage.FLIP_CONFUSION) {
              store.dispatch(new ResolvePromptAction(next.id, true));
            } else {
              break;
            }
          }
        });
      } catch {
        ok = false;
      }
      snap.restore();
      if (ok) {
        legal.push(cand);
      }
    }
    return legal;
  }

  private policyOf(playerIdx: number): PolicyName {
    return this.opts.policy[playerIdx];
  }

  private useBot(playerIdx: number): boolean {
    const pol = this.policyOf(playerIdx);
    if (pol === 'bot') {
      return true;
    }
    if (pol.startsWith('mix:')) {
      const eps = parseFloat(pol.slice(4));
      return this.policyRng.float() >= eps;
    }
    return false;
  }

  private botAction(playerIdx: number): any {
    const store = this.store;
    return withRollback([store, oracleCopyAttackSessions()], () => Chance.sim(() => {
      try {
        return this.bots[playerIdx].decodeNextAction(store.state);
      } catch {
        return undefined;
      }
    }));
  }

  private nextAnswer(): any {
    const answers = this.opts.answers!;
    if (this.answerCursor >= answers.length) {
      throw new Error('replay: out of answers');
    }
    return answers[this.answerCursor++];
  }

  private decidePrompt(prompt: Prompt<any>, playerIdx: number): any {
    if (this.script.length > 0) {
      return this.script.shift();
    }
    if (this.opts.answers) {
      return this.nextAnswer();
    }
    const state = this.state;
    if (this.useBot(playerIdx)) {
      const action = this.botAction(playerIdx);
      if (action instanceof ResolvePromptAction && action.id === prompt.id) {
        try {
          const raw = encodeAnswer(state, prompt, action.result);
          decodeAnswer(state, prompt, raw);
          return raw;
        } catch {
          this.botOffList++;
        }
      } else {
        this.botOffList++;
      }
    }
    return randomAnswer(state, prompt, this.policyRng);
  }

  /**
   * A scripted play may name its card instead of an instance id (ids depend on the shuffle):
   * {"a": "play", "card": "Switch SVI", "target": {...}} matches the first legal play of a card of
   * that full name (or name) in hand with that target (the target is optional).
   */
  private findScriptedPlayByName(options: TurnOption[], player: Player, scripted: any): number {
    if (scripted?.a !== 'play' || typeof scripted.card !== 'string' || scripted.card.includes('#')) {
      return -1;
    }
    const wantTarget = scripted.target === undefined ? undefined : stableStringify(scripted.target);
    return options.findIndex(o => {
      if (o.desc.a !== 'play') {
        return false;
      }
      const card = player.hand.cards[(o.action as PlayCardAction).handIndex];
      if (card === undefined || (card.fullName !== scripted.card && card.name !== scripted.card)) {
        return false;
      }
      return wantTarget === undefined || stableStringify(o.desc.target) === wantTarget;
    });
  }

  private decideTurn(options: TurnOption[], player: Player, playerIdx: number): number {
    if (this.script.length > 0) {
      const scripted = this.script.shift();
      const want = stableStringify(scripted);
      let i = options.findIndex(o => stableStringify(o.desc) === want);
      if (i === -1) {
        i = this.findScriptedPlayByName(options, player, scripted);
      }
      if (i === -1) {
        throw new Error('scenario: scripted answer not among options: ' + want);
      }
      return i;
    }
    if (this.opts.answers) {
      const want = stableStringify(this.nextAnswer());
      const i = options.findIndex(o => stableStringify(o.desc) === want);
      if (i === -1) {
        throw new Error('replay: answer not among options');
      }
      return i;
    }
    if (this.useBot(playerIdx)) {
      const action = this.botAction(playerIdx);
      if (action) {
        const desc = describeAction(this.state, player, action);
        if (desc) {
          const key = stableStringify(desc);
          const i = options.findIndex(o => stableStringify(o.desc) === key);
          if (i !== -1) {
            return i;
          }
        }
      }
      this.botOffList++;
    }
    const passIdx = options.findIndex(o => o.desc.a === 'pass');
    if (this.policyOf(playerIdx) === 'heur') {
      // Cheap "sensible" play without look-ahead (bot games are 5-50x
      // slower): develop the board first (play cards, abilities, stadium),
      // then attack, rarely retreat or pass early.
      const idx = (k: string[]) => options.map((o, i) => (k.includes(o.desc.a) ? i : -1)).filter(i => i !== -1);
      const develop = idx(['play', 'ability', 'trainerAbility', 'energyAbility', 'stadium']);
      const attack = idx(['attack']);
      const retreat = idx(['retreat']);
      const r = this.policyRng.float();
      if (develop.length > 0 && r < 0.8) {
        return develop[this.policyRng.below(develop.length)];
      }
      if (attack.length > 0 && r < 0.97) {
        return attack[this.policyRng.below(attack.length)];
      }
      if (retreat.length > 0 && r < 0.99) {
        return retreat[this.policyRng.below(retreat.length)];
      }
      return passIdx !== -1 ? passIdx : this.policyRng.below(options.length);
    }
    const others = options.map((_, i) => i).filter(i => i !== passIdx);
    if (others.length === 0 || (passIdx !== -1 && this.policyRng.float() < 0.08)) {
      return passIdx;
    }
    return others[this.policyRng.below(others.length)];
  }

  public run(): Trace {
    const opts = this.opts;
    const store = this.store;
    const steps: TraceStep[] = [];
    const maxSteps = opts.maxSteps ?? 4000;
    const maxTurns = opts.maxTurns ?? 120;
    let status: Trace['result']['status'] = 'finished';
    let message: string | undefined;
    let scenarioAt: Trace['scenario'];

    store.dispatch(new AddPlayerAction(PLAYER_IDS[0], 'p1', opts.decks[0]));
    store.dispatch(new AddPlayerAction(PLAYER_IDS[1], 'p2', opts.decks[1]));
    let start: Trace['start'];
    try {
      this.settle();
    } finally {
      const can = this.canonical();
      start = { c: this.takeChance(), h: can.h, e: this.takeEffects(), s: can.s };
    }

    try {
      while (this.state.phase !== GamePhase.FINISHED) {
        if (steps.length >= maxSteps || this.state.turn > maxTurns) {
          status = 'cap';
          break;
        }
        const state = this.state;
        const pending = state.prompts.filter(p => p.result === undefined);
        let step: TraceStep;
        if (pending.length > 0) {
          const prompt = pending[0];
          const p = playerIndex(state, prompt.playerId);
          const d = describePrompt(state, prompt);
          const raw = this.decidePrompt(prompt, p);
          if (raw === undefined) {
            status = 'stuck';
            message = 'no valid answer for ' + prompt.type;
            break;
          }
          const decoded = decodeAnswer(state, prompt, raw);
          store.dispatch(new ResolvePromptAction(prompt.id, decoded));
          step = { i: steps.length, p, d, a: raw, c: [], h: '' };
        } else if (state.phase === GamePhase.PLAYER_TURN) {
          if (opts.scenario && scenarioAt === undefined && state.turn >= scenarioTurn(opts.scenario)) {
            applyScenario(store, state, opts.scenario);
            this.script = (opts.scenario.answers ?? []).slice();
            scenarioAt = { step: steps.length, h: this.canonical().h };
          }
          const player = state.players[state.activePlayer];
          const options = this.legalTurnOptions(player);
          if (options.length === 0) {
            status = 'stuck';
            message = 'no legal turn options';
            break;
          }
          const k = this.decideTurn(options, player, state.activePlayer);
          const p = state.activePlayer;
          store.dispatch(options[k].action);
          step = { i: steps.length, p, d: { kind: 'turn', options: options.map(o => o.desc) }, a: options[k].desc, c: [], h: '' };
        } else {
          status = 'stuck';
          message = 'no prompt outside player turn, phase ' + state.phase;
          break;
        }
        try {
          this.settle();
        } finally {
          const can = this.canonical();
          step.c = this.takeChance();
          step.h = can.h;
          step.e = this.takeEffects();
          step.s = can.s;
          steps.push(step);
        }
      }
    } catch (error: any) {
      status = 'error';
      message = String(error?.message ?? error);
      if (process.env.PTCG_ORACLE_STACK) {
        console.error(error?.stack ?? message);
      }
    }

    return {
      header: {
        seed: opts.seed,
        decks: opts.decks,
        policy: [opts.policy[0], opts.policy[1]],
        twinleaf: TWINLEAF_COMMIT,
        scenario: opts.scenario,
      },
      start,
      steps,
      scenario: scenarioAt,
      result: {
        status,
        winner: this.state.winner,
        turn: this.state.turn,
        message,
        strayRandom: Chance.strayCalls,
        botOffList: this.botOffList,
      },
    };
  }
}

/** Install the stray-random guard once per process. */
export function installRandomGuard(): void {
  (Math as any).random = () => Chance.strayRandom();
}
