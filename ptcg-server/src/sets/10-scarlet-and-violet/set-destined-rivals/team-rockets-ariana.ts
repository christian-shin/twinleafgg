import { GameError } from '../../../game/game-error';
import { GameMessage } from '../../../game/game-message';
import { Effect } from '../../../game/store/effects/effect';
import { TrainerCard } from '../../../game/store/card/trainer-card';
import { CardTag, TrainerType } from '../../../game/store/card/card-types';
import { StoreLike } from '../../../game/store/store-like';
import { Player } from '../../../game/store/state/player';
import { State } from '../../../game/store/state/state';
import { TrainerEffect } from '../../../game/store/effects/play-card-effects';
import { PokemonCard } from '../../../game/store/card/pokemon-card';
import { PlayerType } from '../../../game/store/actions/play-card-action';
import { EndTurnEffect } from '../../../game/store/effects/game-phase-effects';
import { MOVE_CARDS } from '../../../game/store/prefabs/prefabs';

export class TeamRocketsAriana extends TrainerCard {
  public trainerType: TrainerType = TrainerType.SUPPORTER;
  protected _tags = [CardTag.TEAM_ROCKET];
  public regulationMark = 'I';
  public set: string = 'DRI';
  public cardImage: string = 'assets/cardback.png';
  public setNumber: string = '171';
  public name: string = "Team Rocket's Ariana";
  public fullName: string = "Team Rocket's Ariana DRI";

  public text: string =
    "Draw cards until you have 5 cards in your hand. If all of your Pokémon in play are Team Rocket's Pokemon, draw cards until you have 8 cards in your hand instead.";

  // Hand size to draw up to: 8 when all of your Pokémon in play are Team Rocket's Pokémon, else 5.
  private targetHandSize(player: Player): number {
    let allTeamRocket = true;
    let hasPokemon = false;

    // Check active
    if (player.active.cards.length > 0) {
      hasPokemon = true;
      const activePokemon = player.active.getPokemonCard();
      if (!activePokemon || !activePokemon.hasTag(CardTag.TEAM_ROCKET)) {
        allTeamRocket = false;
      }
    }

    // Check bench
    player.forEachPokemon(PlayerType.BOTTOM_PLAYER, (cardList, card) => {
      if (cardList !== player.active && card instanceof PokemonCard) {
        hasPokemon = true;
        if (!card.hasTag(CardTag.TEAM_ROCKET)) {
          allTeamRocket = false;
        }
      }
    });

    return hasPokemon && allTeamRocket ? 8 : 5;
  }

  // "Draw cards until you have N cards in your hand": a card that would draw nothing (no card in the
  // deck, or already N cards in hand without this one) can't be played (rulings 851, 959).
  private canDraw(player: Player): boolean {
    return player.deck.cards.length > 0
      && player.hand.cards.filter(c => c !== this).length < this.targetHandSize(player);
  }

  public canPlay(store: StoreLike, state: State, player: Player): boolean {
    if (player.supporterTurn > 0) {
      return false;
    }
    return this.canDraw(player);
  }

  public reduceEffect(store: StoreLike, state: State, effect: Effect): State {
    if (effect instanceof TrainerEffect && effect.trainerCard === this) {
      const player = effect.player;

      const supporterTurn = player.supporterTurn;
      if (supporterTurn > 0) {
        throw new GameError(GameMessage.SUPPORTER_ALREADY_PLAYED);
      }

      if (!this.canDraw(player)) {
        throw new GameError(GameMessage.CANNOT_PLAY_THIS_CARD);
      }

      // Using the effect of a Supporter as the effect of an attack is not playing it from the hand
      if (!effect.usedAsAttackEffect) {
        player.rocketSupporter = true;
      }
      MOVE_CARDS(store, state, player.hand, player.supporter, { cards: [effect.trainerCard], sourceCard: this });
      effect.preventDefault = true;

      // Set target hand size
      const targetHandSize = this.targetHandSize(player);

      // Draw until target hand size is reached
      while (player.hand.cards.length < targetHandSize) {
        if (player.deck.cards.length === 0) {
          break;
        }
        MOVE_CARDS(store, state, player.deck, player.hand, { count: 1, sourceCard: this });
      }

      return state;
    }

    if (effect instanceof EndTurnEffect && effect.player.rocketSupporter) {
      effect.player.rocketSupporter = false;
    }

    return state;
  }
}
