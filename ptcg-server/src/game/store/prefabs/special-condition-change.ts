import { SpecialCondition } from '../card/card-types';
import { PokemonCardList } from '../state/pokemon-card-list';

/**
 * Would making `target` `conditions` change the game state? (Advanced Rulebook A-02, B-01, B-03: a Trainer card or Ability
 * can't be used when nothing would change; rulings 962, 1565.) Re-applying a Special Condition the Pokemon already has
 * changes nothing, except an "enhanced" one: adding Poisoned / Burned / Confused sets the damage counters of that
 * condition back to the standard 1 / 2 / 3.
 */
export function WOULD_CHANGE_SPECIAL_CONDITIONS(target: PokemonCardList, conditions: SpecialCondition[]): boolean {
  return conditions.some(sp => {
    if (!target.specialConditions.includes(sp)) {
      return true;
    }
    return (sp === SpecialCondition.POISONED && target.poisonDamage !== 10)
      || (sp === SpecialCondition.BURNED && target.burnDamage !== 20)
      || (sp === SpecialCondition.CONFUSED && target.confusionDamage !== 30);
  });
}
