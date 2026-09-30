/**
 * Printed-data extraction for tier 0 (PLAN.md 4.4): every own data field of a
 * card class instance, with functions replaced by a marker and prototype
 * methods listed, so the Rust card database can be generated and checked.
 */
import { Card } from '../game/store/card/card';

function data(v: any, depth: number): any {
  if (v === null || v === undefined) {
    return null;
  }
  if (typeof v === 'function') {
    return { $fn: true };
  }
  if (typeof v !== 'object') {
    return v;
  }
  if (depth > 6) {
    return '<deep>';
  }
  if (v instanceof Card) {
    return { $card: v.fullName };
  }
  if (Array.isArray(v)) {
    return v.map(x => data(x, depth + 1));
  }
  if (Array.isArray(v.cards)) {
    return { $cards: v.cards.map((c: Card) => c.fullName) };
  }
  const out: any = {};
  for (const key of Object.keys(v)) {
    out[key] = data(v[key], depth + 1);
  }
  return out;
}

export function dumpCard(card: Card): any {
  const out: any = { $class: card.constructor.name };
  for (const key of Object.keys(card)) {
    out[key] = data((card as any)[key], 0);
  }
  const methods: string[] = [];
  const chain: { cls: string, own: string[] }[] = [];
  let proto = Object.getPrototypeOf(card);
  const base = new Set(['constructor']);
  while (proto && proto.constructor && proto.constructor.name !== 'Object') {
    const cls = proto.constructor.name;
    if (cls === 'Card' || cls === 'PokemonCard' || cls === 'TrainerCard' || cls === 'EnergyCard') {
      break;
    }
    const own: string[] = [];
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (!base.has(name)) {
        own.push(name);
      }
      if (!base.has(name) && !methods.includes(name)) {
        methods.push(name);
      }
    }
    chain.push({ cls, own });
    proto = Object.getPrototypeOf(proto);
  }
  out.$methods = methods;
  out.$chain = chain;
  out.$base = Object.getPrototypeOf(Object.getPrototypeOf(card))?.constructor?.name;
  return out;
}
