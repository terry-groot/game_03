import type { Tile, Meld, WinResult, MeldGroup, FanBreakdown, FanItem } from './types';
import { isSuited, isHonor, isFlower } from './tileUtils';

// ============================================================
// Win Detection — Taiwanese 16-tile Mahjong
// Win condition: 4 melds (順子/刻子) + 1 pair (雀頭) = 14 concealed tiles
// (Plus any number of revealed melds from pong/chi/kong)
// ============================================================

/**
 * Check if a given hand can form a winning combination.
 * `hand`: concealed tiles (must have (14 - 3*revealedMelds.length) tiles)
 * `revealedMelds`: already revealed melds
 * `winTile`: the tile that completes the hand
 * `isSelfDraw`: whether the win tile was drawn from wall
 */
export function checkWin(
  hand: Tile[],
  revealedMelds: Meld[],
  winTile: Tile,
  isSelfDraw: boolean
): WinResult | null {
  // Make sure winTile is included in the hand for evaluation
  const fullHand = hand.some(t => t.id === winTile.id) ? hand : [...hand, winTile];

  // For non-concealed tiles check: hand should have 14 - 3*revealed melds
  // We just check all tiles together
  const sorted = [...fullHand].sort((a, b) => a.typeIndex - b.typeIndex);

  const groups = partitionIntoMeldsAndPair(sorted);
  if (!groups) return null;

  return {
    isWin: true,
    hand: fullHand,
    melds: groups.melds,
    pair: groups.pair,
    winTile,
    isSelfDraw,
  };
}

interface PartitionResult {
  melds: MeldGroup[];
  pair: Tile[];
}

/**
 * Try to partition `tiles` into n melds + 1 pair.
 * Uses backtracking with memoization.
 */
function partitionIntoMeldsAndPair(tiles: Tile[]): PartitionResult | null {
  if (tiles.length < 2 || tiles.length % 3 !== 2) return null;

  // Try each possible pair
  const seen = new Set<number>();
  for (let i = 0; i < tiles.length; i++) {
    const pairType = tiles[i].typeIndex;
    if (seen.has(pairType)) continue;
    seen.add(pairType);

    // Collect a pair of this type
    const pairTiles: Tile[] = [];
    const rest: Tile[] = [];
    let pairFound = false;
    for (const t of tiles) {
      if (!pairFound && t.typeIndex === pairType && pairTiles.length < 2) {
        pairTiles.push(t);
        if (pairTiles.length === 2) pairFound = true;
      } else {
        rest.push(t);
      }
    }
    if (pairTiles.length < 2) continue;

    // Try to partition rest into melds
    const melds: MeldGroup[] = [];
    if (partitionIntoMelds(rest, melds)) {
      return { melds, pair: pairTiles };
    }
  }
  return null;
}

/**
 * Recursive backtracking: partition `tiles` into groups of 3 (chi or pong).
 * Tiles must be sorted by typeIndex.
 */
function partitionIntoMelds(tiles: Tile[], result: MeldGroup[]): boolean {
  if (tiles.length === 0) return true;

  // Always work with the first tile (smallest typeIndex)
  const first = tiles[0];
  const rest = tiles.slice(1);

  // Try pong first (same typeIndex × 3)
  const pongCandidates = rest.filter(t => t.typeIndex === first.typeIndex);
  if (pongCandidates.length >= 2) {
    const pongTiles = [first, pongCandidates[0], pongCandidates[1]];
    const pongIds = new Set(pongTiles.map(t => t.id));
    const remaining = tiles.filter(t => !pongIds.has(t.id));
    result.push({ type: 'pong', tiles: pongTiles });
    if (partitionIntoMelds(remaining, result)) return true;
    result.pop();
  }

  // Try chi (consecutive same suit)
  if (isSuited(first)) {
    const v2 = rest.find(t => t.suit === first.suit && t.value === first.value + 1);
    if (v2) {
      const rest2 = rest.filter(t => t.id !== v2.id);
      const v3 = rest2.find(t => t.suit === first.suit && t.value === first.value + 2);
      if (v3) {
        const chiTiles = [first, v2, v3];
        const chiIds = new Set(chiTiles.map(t => t.id));
        const remaining = tiles.filter(t => !chiIds.has(t.id));
        result.push({ type: 'chi', tiles: chiTiles });
        if (partitionIntoMelds(remaining, result)) return true;
        result.pop();
      }
    }
  }

  return false;
}

// ============================================================
// Tenpai Detection
// Returns the list of tile typeIndexes that would complete the hand
// ============================================================

/**
 * Given a hand (without the win tile), return which tile typeIndexes would win.
 * `hand`: current concealed tiles (should have 13 tiles for standard check)
 */
export function computeTenpai(hand: Tile[], revealedMelds: Meld[]): number[] {
  const winningTypes: number[] = [];

  // Check all possible typeIndexes (0–33)
  for (let typeIndex = 0; typeIndex < 34; typeIndex++) {
    // Create a dummy tile of this type for testing
    const dummyTile: Tile = {
      id: typeIndex * 4 + 99, // fake id
      typeIndex,
      suit: typeIndex < 9 ? 'Man' : typeIndex < 18 ? 'Pin' : typeIndex < 27 ? 'Sou' : typeIndex < 31 ? 'Wind' : 'Dragon',
      value: typeIndex < 27 ? (typeIndex % 9) + 1 : typeIndex < 31 ? typeIndex - 26 : typeIndex - 30,
      display: '',
      copyIndex: 3,
    };

    const testHand = [...hand, dummyTile].sort((a, b) => a.typeIndex - b.typeIndex);
    if (partitionIntoMeldsAndPair(testHand)) {
      winningTypes.push(typeIndex);
    }
  }
  return winningTypes;
}

// ============================================================
// Fan Scoring
// ============================================================

interface WinContext {
  isSelfDraw: boolean;
  isDealer: boolean;
  revealedMelds: Meld[];
  flowerCount: number;
  roundWind: number;     // 1–4
  seatWind: number;      // 1–4
  winResult: WinResult;
}

export function calculateFan(ctx: WinContext): FanBreakdown {
  const items: FanItem[] = [];
  const { winResult, revealedMelds, isSelfDraw, isDealer, flowerCount } = ctx;

  // Base 1 fan
  items.push({ name: 'base', nameZh: '底和', fan: 1 });

  const allMelds = [
    ...revealedMelds.map(m => ({ type: m.type as 'chi' | 'pong' | 'kong', tiles: m.tiles })),
    ...winResult.melds,
  ];

  // All pong (對對和) — no chi in hand or revealed
  const allPong = allMelds.every(m => m.type === 'pong' || m.type === 'kong');
  if (allPong) {
    items.push({ name: 'all_pong', nameZh: '對對和', fan: 2 });
  }

  // Self-draw (自摸)
  if (isSelfDraw) {
    items.push({ name: 'self_draw', nameZh: '自摸', fan: 1 });
  }

  // Dealer win (莊家和)
  if (isDealer) {
    items.push({ name: 'dealer', nameZh: '莊家', fan: 1 });
  }

  // Concealed hand (門前清) — no revealed melds and not self-draw win from discard
  if (revealedMelds.length === 0 && !isSelfDraw) {
    items.push({ name: 'concealed', nameZh: '門前清', fan: 1 });
  }

  // Pure suit (清一色) — all tiles same suit
  const allTiles = [
    ...winResult.hand,
    ...revealedMelds.flatMap(m => m.tiles),
    ...winResult.pair,
  ].filter(t => !isFlower(t));

  const suits = new Set(allTiles.map(t => t.suit));
  if (suits.size === 1 && (suits.has('Man') || suits.has('Pin') || suits.has('Sou'))) {
    items.push({ name: 'pure_suit', nameZh: '清一色', fan: 5 });
  }

  // All honors (字一色)
  if (allTiles.every(t => isHonor(t))) {
    items.push({ name: 'all_honors', nameZh: '字一色', fan: 5 });
  }

  // Mixed terminals (混老頭) — only 1s, 9s, and honors
  const isTerminalOrHonor = (t: Tile) =>
    isHonor(t) || (isSuited(t) && (t.value === 1 || t.value === 9));
  if (allTiles.every(isTerminalOrHonor) && !allTiles.every(isHonor)) {
    items.push({ name: 'mixed_terminals', nameZh: '混老頭', fan: 3 });
  }

  // Kongs
  const kongCount = allMelds.filter(m => m.type === 'kong').length;
  for (let k = 0; k < kongCount; k++) {
    items.push({ name: 'kong', nameZh: '槓', fan: 1 });
  }

  // Flowers
  for (let f = 0; f < flowerCount; f++) {
    items.push({ name: 'flower', nameZh: '花牌', fan: 1 });
  }

  const totalFan = items.reduce((sum, i) => sum + i.fan, 0);
  const basePoints = 1000;
  const finalPoints = basePoints * Math.pow(2, totalFan - 1);

  return { items, totalFan, basePoints, finalPoints };
}

/**
 * Check if a player can chi (sequence claim) from a specific discard.
 * Returns valid chi tile combinations from `hand` with the `discard`.
 * Only the left player (next in turn order) can chi.
 */
export function getValidChiOptions(hand: Tile[], discard: Tile): [Tile, Tile][] {
  if (!isSuited(discard)) return [];
  const options: [Tile, Tile][] = [];

  // Find all suited tiles of same suit in hand
  const sameSuit = hand.filter(t => t.suit === discard.suit);

  // Pattern 1: discard is lowest (d, d+1, d+2)
  const h1 = sameSuit.find(t => t.value === discard.value + 1);
  const h2 = sameSuit.find(t => t.value === discard.value + 2);
  if (h1 && h2) options.push([h1, h2]);

  // Pattern 2: discard is middle (d-1, d, d+1)
  const h3 = sameSuit.find(t => t.value === discard.value - 1);
  const h4 = sameSuit.find(t => t.value === discard.value + 1);
  if (h3 && h4) options.push([h3, h4]);

  // Pattern 3: discard is highest (d-2, d-1, d)
  const h5 = sameSuit.find(t => t.value === discard.value - 2);
  const h6 = sameSuit.find(t => t.value === discard.value - 1);
  if (h5 && h6) options.push([h5, h6]);

  // De-duplicate (different tile objects might have same typeIndex combination)
  const seen = new Set<string>();
  return options.filter(([a, b]) => {
    const key = [a.typeIndex, b.typeIndex].sort().join('-');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Count matching typeIndexes in hand to see if pong/kong is possible.
 */
export function countMatchingTiles(hand: Tile[], typeIndex: number): number {
  return hand.filter(t => t.typeIndex === typeIndex).length;
}
