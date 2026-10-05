/** Instrumentation points used by the oracle runner (no effect when unset). */
export const OracleHooks: {
  onEffect?: (effect: any) => void;
  beforeCardReduce?: (card: any, effect: any) => void;
  afterCardReduce?: (card: any, effect: any) => void;
  /** Skip Store.reduce's deep-clone backup (the oracle restores state itself). */
  noBackup?: boolean;
  /** Skip Store.calculatePlayability (client UI hints): its canPlay probes run on the live state and rewrite derived fields such as hpBonus. */
  noPlayability?: boolean;
} = {};
