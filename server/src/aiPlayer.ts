import { Tile, Meld } from '@mahjong/shared';
import {
  sortTiles, isSuited, isHonor, countMatchingTiles,
  checkWin, computeTenpai, getValidChiOptions,
} from '@mahjong/shared';
import { ServerGameState } from './gameEngine';

// ============================================================
// AI Player Decision Engine
// Heuristic rule-based approach for casual play
// ============================================================

/**
 * Decide which tile to discard.
 * Returns the tile ID to discard.
 */
export function decideDiscard(state: ServerGameState, seatIndex: number): number {
  const player = state.players[seatIndex];
  const hand = player.hand;

  if (hand.length === 0) throw new Error('Empty hand');

  // Score each possible discard: higher = better remaining hand
  let bestScore = -Infinity;
  let bestTileId = hand[0].id;

  for (const tile of hand) {
    const remaining = hand.filter(t => t.id !== tile.id);
    const score = scoreHand(remaining, player.melds);
    if (score > bestScore) {
      bestScore = score;
      bestTileId = tile.id;
    }
  }

  return bestTileId;
}

/**
 * Score a hand: higher is better (closer to winning)
 */
function scoreHand(hand: Tile[], melds: Meld[]): number {
  let score = 0;

  // Check for tenpai (聽牌) — strong bonus
  const tenpaiTypes = computeTenpai(hand, melds);
  if (tenpaiTypes.length > 0) {
    score += 30 + tenpaiTypes.length; // more waiting tiles = slightly better
    return score;
  }

  // Count complete melds (triplets and sequences within hand)
  const { completeCount, partialCount } = countMeldPotential(hand);
  score += completeCount * 4;
  score += partialCount * 2;

  return score;
}

interface MeldPotential {
  completeCount: number;
  partialCount: number;
}

/**
 * Count complete melds and partial melds (2-tile partial sequences/pairs) in a hand.
 * Uses a greedy approach for speed (sufficient for AI).
 */
function countMeldPotential(hand: Tile[]): MeldPotential {
  const sorted = sortTiles([...hand]);
  const used = new Set<number>();
  let completeCount = 0;
  let partialCount = 0;

  // Pass 1: Find complete pongs
  const typeGroups = new Map<number, Tile[]>();
  for (const t of sorted) {
    const g = typeGroups.get(t.typeIndex) ?? [];
    g.push(t);
    typeGroups.set(t.typeIndex, g);
  }

  for (const [typeIndex, group] of typeGroups) {
    if (group.length >= 3 && !used.has(group[0].id)) {
      completeCount++;
      used.add(group[0].id);
      used.add(group[1].id);
      used.add(group[2].id);
    }
  }

  // Pass 2: Find complete chis (in remaining tiles)
  const remaining = sorted.filter(t => !used.has(t.id));
  for (const t of remaining) {
    if (used.has(t.id) || !isSuited(t)) continue;
    const v2 = remaining.find(r => !used.has(r.id) && r.suit === t.suit && r.value === t.value + 1);
    const v3 = remaining.find(r => !used.has(r.id) && r.suit === t.suit && r.value === t.value + 2);
    if (v2 && v3) {
      completeCount++;
      used.add(t.id);
      used.add(v2.id);
      used.add(v3.id);
    }
  }

  // Pass 3: Partial pairs and sequences in remaining
  const remaining2 = sorted.filter(t => !used.has(t.id));
  for (const t of remaining2) {
    if (used.has(t.id)) continue;
    // Pair
    const pair = remaining2.find(r => !used.has(r.id) && r.id !== t.id && r.typeIndex === t.typeIndex);
    if (pair) {
      partialCount++;
      used.add(t.id);
      used.add(pair.id);
      continue;
    }
    // Sequence 2-tile
    if (isSuited(t)) {
      const neighbor = remaining2.find(r =>
        !used.has(r.id) && r.suit === t.suit &&
        (r.value === t.value + 1 || r.value === t.value + 2 || r.value === t.value - 1 || r.value === t.value - 2)
      );
      if (neighbor) {
        partialCount++;
        used.add(t.id);
        used.add(neighbor.id);
      }
    }
  }

  return { completeCount, partialCount };
}

/**
 * Decide whether to claim a discarded tile.
 * Returns: 'hu' | 'kong' | 'pong' | 'chi' | 'pass' and chiTiles if chi.
 */
export function decideClaim(
  state: ServerGameState,
  seatIndex: number,
  canChi: boolean
): { action: 'hu' | 'kong' | 'pong' | 'chi' | 'pass'; chiTiles?: [number, number] } {
  const discard = state.lastDiscard;
  if (!discard) return { action: 'pass' };

  const player = state.players[seatIndex];
  const hand = player.hand;

  // Always win if possible
  const winCheck = checkWin(hand, player.melds, discard, false);
  if (winCheck) return { action: 'hu' };

  // Kong: requires 3 matching tiles in hand
  if (countMatchingTiles(hand, discard.typeIndex) >= 3) {
    // Only kong if wall has enough tiles
    if (state.wall.length > 4) return { action: 'kong' };
  }

  // Pong: requires 2 matching tiles in hand
  if (countMatchingTiles(hand, discard.typeIndex) >= 2) {
    const hypotheticalHand = hand.filter(t => t.typeIndex !== discard.typeIndex).slice(2);
    const hypotheticalMelds = [...player.melds, { type: 'pong' as const, tiles: [] }];
    const tenpaiAfterPong = computeTenpai(hypotheticalHand, hypotheticalMelds);
    // Pong if it helps tenpai (at least 1 winning tile after pong)
    if (tenpaiAfterPong.length > 0) {
      return { action: 'pong' };
    }
    // Also pong if we have a lot of pairs (defensive pong)
    if (hand.filter(t => countMatchingTiles(hand, t.typeIndex) >= 2).length >= 4) {
      return { action: 'pong' };
    }
  }

  // Chi (only allowed from left player)
  if (canChi) {
    const chiOptions = getValidChiOptions(hand, discard);
    for (const [a, b] of chiOptions) {
      // After chi, check if we can discard safely and improve tenpai
      const handAfterChi = hand.filter(t => t.id !== a.id && t.id !== b.id);
      const tenpaiAfterChi = computeTenpai(handAfterChi, player.melds);
      if (tenpaiAfterChi.length > 0) {
        return { action: 'chi', chiTiles: [a.id, b.id] };
      }
    }
  }

  return { action: 'pass' };
}

/**
 * Decide whether to declare a concealed kong during own turn.
 * Returns tile ID for kong, or null if not declaring.
 */
export function decideConcealedKong(state: ServerGameState, seatIndex: number): number | null {
  const player = state.players[seatIndex];

  for (const tile of player.hand) {
    const count = countMatchingTiles(player.hand, tile.typeIndex);
    if (count >= 4 && state.wall.length > 4) {
      // Only kong if it doesn't break tenpai
      const handWithoutKong = player.hand.filter(t => t.typeIndex !== tile.typeIndex);
      const tenpai = computeTenpai(handWithoutKong, player.melds);
      if (tenpai.length > 0 || player.melds.length === 0) {
        return tile.id;
      }
    }
  }
  return null;
}
