import {
  CardTag,
  CardType,
  DiscardEnergyPrompt,
  GameMessage,
  PlayerType,
  PokemonCard,
  SlotType,
  Stage,
  State,
  StateUtils,
  StoreLike,
  SuperType,
} from '../../../game';
import { CardTarget } from '../../../game/store/actions/play-card-action';
import { Effect } from '../../../game/store/effects/effect';
import {WAS_ATTACK_USED, MOVE_CARDS } from '../../../game/store/prefabs/prefabs';
import { BLOCKED_NON_TYPE_ENERGY, ENERGY_CARDS_THAT_PROVIDE_TYPE } from '../../../game/store/prefabs/costs';

export class MegaCharizardXex extends PokemonCard {
  public stage: Stage = Stage.STAGE_2;
  public evolvesFrom: string = 'Charmeleon';
  protected _tags = [CardTag.POKEMON_SV_MEGA, CardTag.POKEMON_ex];
  public cardType: CardType[] = [R];
  public hp: number = 360;
  public weakness = [{ type: W }];
  public retreat = [C, C];

  public attacks = [
    {
      name: 'Inferno X',
      cost: [R, R],
      damage: 90,
      damageCalculation: 'x',
      text: 'Discard any amount of [R] Energy from among your Pokémon, and this attack does 90 damage for each card you discarded in this way.',
    },
  ];

  public regulationMark: string = 'I';
  public set: string = 'PFL';
  public setNumber: string = '13';
  public cardImage: string = 'assets/cardback.png';
  public name: string = 'Mega Charizard X ex';
  public fullName: string = 'Mega Charizard X ex M2';

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (WAS_ATTACK_USED(effect, 0, this)) {
      const player = effect.player;

      // "[R] Energy": every Energy that provides [R] as it is provided now, including an Energy that provides
      // every type (Legacy Energy, Prism Energy on a Basic Pokémon) (Advanced Rulebook D-08).
      let totalEnergy = 0;
      player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList) => {
        totalEnergy += ENERGY_CARDS_THAT_PROVIDE_TYPE(store, state, player, cardList, CardType.FIRE).length;
      });

      // Nothing to discard (a copied Inferno X, the copycat has no [R] Energy): no damage, and no
      // prompt without a valid answer
      if (totalEnergy === 0) {
        effect.damage = 0;
        return state;
      }

      // Create blocked map for energy that doesn't provide Fire or Any type
      const blockedFrom: CardTarget[] = [];
      const blockedMap: { source: CardTarget; blocked: number[] }[] = [];

      player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList, card, target) => {
        // Block energy that doesn't provide Fire or Any type
        const entry = BLOCKED_NON_TYPE_ENERGY(store, state, player, cardList, target, CardType.FIRE);
        if (entry !== undefined) {
          blockedMap.push(entry);
        }
      });

      return store.prompt(
        state,
        new DiscardEnergyPrompt(
          player.id,
          GameMessage.CHOOSE_ENERGIES_TO_DISCARD,
          PlayerType.BOTTOM_PLAYER,
          [SlotType.ACTIVE, SlotType.BENCH], // Card source is target Pokemon
          { superType: SuperType.ENERGY },
          { min: 0, max: totalEnergy, allowCancel: false, blockedFrom, blockedMap },
        ),
        (transfers) => {
          // "any amount" can be 0 (ruling 1778): then the attack does 0 damage
          if (transfers === null) {
            effect.damage = 0;
            return state;
          }
          effect.damage = transfers.length * 90;
          for (const transfer of transfers) {
            const source = StateUtils.getTarget(state, player, transfer.from);
            const target = player.discard;
            MOVE_CARDS(store, state, source, target, { cards: [transfer.card], sourceCard: this, afterDamageOf: effect });
          }
          return state;
        },
      );
    }
    return state;
  }
}
