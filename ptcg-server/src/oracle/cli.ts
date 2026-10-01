/* eslint-disable no-console */
/**
 * Oracle command line.
 *
 *   node output/oracle/cli.js dump-cards <out.json>
 *   node output/oracle/cli.js play <deckA.txt> <deckB.txt> <seed> <policyA,policyB> [out.json]
 *   node output/oracle/cli.js determinism <deckA.txt> <deckB.txt> <seeds> <policyA,policyB>
 *   node output/oracle/cli.js corpus <spec.json> <outDir> <start> <count>
 *   node output/oracle/cli.js replay <scouted.json> <outDir> [start] [count]
 */
import * as fs from 'fs';
import * as path from 'path';
import { loadAllCards } from './load-cards';
import { GameRunner, installRandomGuard, Trace, PolicyName } from './runner';
import { dumpCard } from './dump';

function readDeck(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) {
      continue;
    }
    const m = /^(\d+)\s+(.+)$/.exec(t);
    if (m) {
      for (let i = 0; i < parseInt(m[1], 10); i++) {
        out.push(m[2]);
      }
    } else {
      out.push(t);
    }
  }
  return out;
}

function policies(arg: string): [PolicyName, PolicyName] {
  const parts = arg.split(',');
  return [parts[0], parts[1] ?? parts[0]];
}

export function playOnce(decks: [string[], string[]], seed: number, policy: [PolicyName, PolicyName], extra: any = {}): Trace {
  const runner = new GameRunner({ seed, decks, policy, effects: true, ...extra });
  return runner.run();
}

function summary(t: Trace): string {
  const r = t.result;
  return `seed=${t.header.seed} status=${r.status} winner=${r.winner} turn=${r.turn} steps=${t.steps.length}`
    + ` stray=${r.strayRandom} botOff=${r.botOffList}${r.message ? ' msg=' + r.message : ''}`;
}

function main(argv: string[]): void {
  installRandomGuard();
  const cmd = argv[0];
  if (cmd === 'dump-cards') {
    const cm = loadAllCards();
    const all = cm.getAllCards().map(c => dumpCard(c));
    fs.writeFileSync(argv[1], JSON.stringify(all));
    console.log(`dumped ${all.length} cards`);
    return;
  }
  if (cmd === 'play') {
    const decks: [string[], string[]] = [readDeck(argv[1]), readDeck(argv[2])];
    const t0 = Date.now();
    const trace = playOnce(decks, parseInt(argv[3], 10), policies(argv[4] ?? 'random'));
    console.log(summary(trace), `${Date.now() - t0}ms`);
    if (argv[5]) {
      fs.writeFileSync(argv[5], JSON.stringify(trace));
    }
    return;
  }
  if (cmd === 'determinism') {
    const decks: [string[], string[]] = [readDeck(argv[1]), readDeck(argv[2])];
    const seeds = argv[3].split(',').map(s => parseInt(s, 10));
    let bad = 0;
    for (const seed of seeds) {
      const a = playOnce(decks, seed, policies(argv[4] ?? 'random'));
      const b = playOnce(decks, seed, policies(argv[4] ?? 'random'));
      const ha = [a.start.h, ...a.steps.map(s => s.h)];
      const hb = [b.start.h, ...b.steps.map(s => s.h)];
      const n = Math.max(ha.length, hb.length);
      let first = -1;
      for (let i = 0; i < n; i++) {
        if (ha[i] !== hb[i]) {
          first = i;
          break;
        }
      }
      if (first !== -1) {
        bad++;
        console.log(`seed ${seed}: DIVERGED at step ${first - 1}`);
      } else {
        console.log(`seed ${seed}: identical (${n} hashes) ${summary(a)}`);
      }
    }
    process.exitCode = bad > 0 ? 1 : 0;
    return;
  }
  if (cmd === 'regen') {
    // Re-run traces from their headers (seed, decks, policies) in place.
    for (const file of argv.slice(1)) {
      const old: Trace = JSON.parse(fs.readFileSync(file, 'utf8'));
      let trace: Trace;
      try {
        trace = playOnce(old.header.decks, old.header.seed, old.header.policy as [PolicyName, PolicyName]);
      } catch (e: any) {
        console.log(`${file} crashed: ${e?.message}`);
        continue;
      }
      (trace.header as any).deckNames = (old.header as any).deckNames;
      fs.writeFileSync(file, JSON.stringify(trace));
      console.log(`${file}: ${summary(trace)}`);
    }
    return;
  }
  if (cmd === 'state') {
    // Replay a trace's answers and print the canonical state after step k (-1 = start).
    const trace: Trace = JSON.parse(fs.readFileSync(argv[1], 'utf8'));
    const k = parseInt(argv[2], 10);
    const answers = trace.steps.slice(0, k + 1).map(s => s.a);
    const runner = new GameRunner({
      seed: trace.header.seed, decks: trace.header.decks, policy: trace.header.policy,
      answers, keepStates: true, effects: true, maxSteps: k + 1,
    });
    const t = runner.run();
    const out = k < 0 ? { s: t.start.s, e: t.start.e } : { s: t.steps[k]?.s, e: t.steps[k]?.e, d: t.steps[k]?.d };
    process.stdout.write(JSON.stringify(out, null, 1));
    return;
  }
  if (cmd === 'replay') {
    // Replay scouted games (seed, decks, answers) chosen by the Rust `scout`
    // tool: every oracle game spent is one that exercises the target cards.
    const games: { seed: number, decks: [string[], string[]], deckNames?: string[], answers: any[] }[] =
      JSON.parse(fs.readFileSync(argv[1], 'utf8'));
    const outDir = argv[2];
    const start = parseInt(argv[3] ?? '0', 10);
    const count = parseInt(argv[4] ?? String(games.length), 10);
    fs.mkdirSync(outDir, { recursive: true });
    for (let i = start; i < Math.min(games.length, start + count); i++) {
      const g = games[i];
      const t0 = Date.now();
      let trace: Trace;
      try {
        trace = new GameRunner({ seed: g.seed, decks: g.decks, policy: ['replay', 'replay'], answers: g.answers, effects: true }).run();
      } catch (e: any) {
        console.log(`game ${g.seed} crashed: ${e?.message}`);
        continue;
      }
      (trace.header as any).deckNames = g.deckNames;
      if (process.env.NODE_V8_COVERAGE) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('v8').takeCoverage();
        fs.writeFileSync(path.join(process.env.NODE_V8_COVERAGE, `game-${g.seed}.marker`), '');
      }
      fs.writeFileSync(path.join(outDir, `g${String(g.seed).padStart(6, '0')}.json`), JSON.stringify(trace));
      console.log(`game ${g.seed} replay: ${summary(trace)} ${Date.now() - t0}ms`);
    }
    return;
  }
  if (cmd === 'corpus') {
    const spec = JSON.parse(fs.readFileSync(argv[1], 'utf8'));
    const outDir = argv[2];
    const start = parseInt(argv[3], 10);
    const count = parseInt(argv[4], 10);
    fs.mkdirSync(outDir, { recursive: true });
    const decks: { name: string, cards: string[] }[] = spec.decks;
    const pols: string[] = spec.policies;
    for (let g = start; g < start + count; g++) {
      // Deterministic pairing from the game index.
      const a = decks[g % decks.length];
      const b = decks[Math.floor(g / decks.length) % decks.length];
      const pol = pols[g % pols.length];
      const t0 = Date.now();
      let trace: Trace;
      try {
        trace = playOnce([a.cards, b.cards], g, policies(pol), spec.scenario ? { scenario: spec.scenario } : {});
      } catch (e: any) {
        console.log(`game ${g} crashed: ${e?.message}`);
        continue;
      }
      (trace.header as any).deckNames = [a.name, b.name];
      if (process.env.NODE_V8_COVERAGE) {
        // One coverage snapshot per game: per-trace branch coverage (PLAN.md 4.5).
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('v8').takeCoverage();
        fs.writeFileSync(path.join(process.env.NODE_V8_COVERAGE, `game-${g}.marker`), '');
      }
      fs.writeFileSync(path.join(outDir, `g${String(g).padStart(6, '0')}.json`), JSON.stringify(trace));
      console.log(`game ${g} ${a.name} vs ${b.name} ${pol}: ${summary(trace)} ${Date.now() - t0}ms`);
    }
    return;
  }
  console.log('unknown command');
  process.exitCode = 2;
}

main(process.argv.slice(2));
