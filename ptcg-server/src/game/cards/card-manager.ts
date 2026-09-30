import { Card } from '../store/card/card';
import { deepClone } from '../../utils/utils';
import { CardsInfo } from '../../backend/interfaces/cards.interface';

export class CardManager {

  private static instance: CardManager;
  private cards: Card[] = [];
  private cardIndex: { [name: string]: number } = {};

  public static getInstance(): CardManager {
    if (!CardManager.instance) {
      CardManager.instance = new CardManager();
    }
    return CardManager.instance;
  }

  /**
   * Validates all sets for duplicate fullName and legacyFullName without loading.
   * Returns an array of error messages (one per duplicate). Empty if no issues.
   */
  public static validateAllSets(
    entries: Array<{ key: string; cards: Card[] }>
  ): string[] {
    const fullNameMap: { [name: string]: Array<{ key: string }> } = {};
    const legacyFullNameMap: { [name: string]: Array<{ key: string }> } = {};

    for (const { key, cards } of entries) {
      if (!Array.isArray(cards)) continue;
      for (const card of cards) {
        const fullName = card.fullName;
        if (!fullNameMap[fullName]) fullNameMap[fullName] = [];
        fullNameMap[fullName].push({ key });

        const p = card as { legacyFullName?: string };
        if (p.legacyFullName) {
          const legacyName = p.legacyFullName;
          if (!legacyFullNameMap[legacyName]) legacyFullNameMap[legacyName] = [];
          legacyFullNameMap[legacyName].push({ key });
        }
      }
    }

    const errors: string[] = [];
    for (const [name, entriesList] of Object.entries(fullNameMap)) {
      if (entriesList.length > 1) {
        const setKeys = [...new Set(entriesList.map((e) => e.key))];
        errors.push(`Duplicate fullName '${name}': in ${setKeys.join(', ')}`);
      }
    }
    for (const [name, entriesList] of Object.entries(legacyFullNameMap)) {
      if (entriesList.length > 1) {
        const setKeys = [...new Set(entriesList.map((e) => e.key))];
        errors.push(`Duplicate legacyFullName '${name}': in ${setKeys.join(', ')}`);
      }
    }
    return errors;
  }

  // Static lookups over the card database for cards that search "all known
  // cards" on every legality check (Salvatore, Grand Tree, ...). Rebuilt
  // whenever a set is defined.
  private nonBasicCache: any[] | undefined;
  private evolvesFromCache: Map<string, any[]> | undefined;

  /** All Pokémon cards that are not Basic, in getAllCards() order. */
  public getNonBasicPokemon(): any[] {
    if (this.nonBasicCache === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { PokemonCard } = require('../store/card/pokemon-card');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Stage } = require('../store/card/card-types');
      this.nonBasicCache = this.getAllCards().filter(c => c instanceof PokemonCard && (c as any).stage !== Stage.BASIC);
    }
    return this.nonBasicCache;
  }

  /** Non-Basic Pokémon whose evolvesFrom is `name`, in getAllCards() order. */
  public getEvolutionsFrom(name: string): any[] {
    if (this.evolvesFromCache === undefined) {
      const m = new Map<string, any[]>();
      for (const c of this.getNonBasicPokemon()) {
        const list = m.get(c.evolvesFrom);
        if (list) {
          list.push(c);
        } else {
          m.set(c.evolvesFrom, [c]);
        }
      }
      this.evolvesFromCache = m;
    }
    return this.evolvesFromCache.get(name) || [];
  }

  public defineSet(set: Card[]): void {
    this.nonBasicCache = undefined;
    this.evolvesFromCache = undefined;
    for (const card of set) {
      if (this.cardIndex[card.fullName] !== undefined) {
        throw new Error('Multiple cards with the same name: ' + card.fullName);
      }

      const index = this.cards.length;
      this.cards.push(card);
      this.cardIndex[card.fullName] = index;

      const p = card as any;
      if (p.legacyFullName) {
        if (this.cardIndex[p.legacyFullName] !== undefined) {
          throw new Error('Multiple cards with the same name: ' + p.legacyFullName);
        }
        this.cardIndex[p.legacyFullName] = index;
      }
    }
  }

  public loadCardsInfo(cardsInfo: CardsInfo) {
    this.cardIndex = {};
    this.cards = cardsInfo.cards;
    for (let i = 0; i < this.cards.length; i++) {
      this.cardIndex[this.cards[i].fullName] = i;
    }
  }

  public defineCard(card: Card): void {
    if (this.cardIndex[card.fullName] !== undefined) {
      throw new Error('Multiple cards with the same name: ' + card.fullName);
    }

    const index = this.cards.length;
    this.cards.push(card);
    this.cardIndex[card.fullName] = index;
  }

  public getCardByName(name: string): Card | undefined {
    const index = this.cardIndex[name];
    if (index !== undefined) {
      return deepClone(this.cards[index]);
    }
  }

  public isCardDefined(name: string): boolean {
    return this.cardIndex[name] !== undefined;
  }

  public getAllCards(): Card[] {
    return this.cards;
  }

}
