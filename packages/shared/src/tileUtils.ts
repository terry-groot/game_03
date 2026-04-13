import type { Tile } from './types';

// ============================================================
// Tile Sorting and Utility Functions
// ============================================================

/**
 * Sort tiles in canonical order: Man → Pin → Sou → Wind → Dragon → Flower
 * Within a suit, sort by value, then by copyIndex.
 */
export function sortTiles(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    if (a.typeIndex !== b.typeIndex) return a.typeIndex - b.typeIndex;
    return a.copyIndex - b.copyIndex;
  });
}

/**
 * Group tiles by typeIndex. Returns a Map<typeIndex, Tile[]>
 */
export function groupByType(tiles: Tile[]): Map<number, Tile[]> {
  const map = new Map<number, Tile[]>();
  for (const tile of tiles) {
    const group = map.get(tile.typeIndex) ?? [];
    group.push(tile);
    map.set(tile.typeIndex, group);
  }
  return map;
}

/**
 * Count tiles by typeIndex. Returns a Map<typeIndex, number>
 */
export function countByType(tiles: Tile[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const tile of tiles) {
    map.set(tile.typeIndex, (map.get(tile.typeIndex) ?? 0) + 1);
  }
  return map;
}

/**
 * Return true if two tiles are of the same type (ignoring copy index)
 */
export function sameType(a: Tile, b: Tile): boolean {
  return a.typeIndex === b.typeIndex;
}

/**
 * Return true if tile is a suited tile (Man, Pin, or Sou)
 */
export function isSuited(tile: Tile): boolean {
  return tile.suit === 'Man' || tile.suit === 'Pin' || tile.suit === 'Sou';
}

/**
 * Return true if tile is an honor tile (Wind or Dragon)
 */
export function isHonor(tile: Tile): boolean {
  return tile.suit === 'Wind' || tile.suit === 'Dragon';
}

/**
 * Return true if tile is a terminal (1 or 9 of a suited suit)
 */
export function isTerminal(tile: Tile): boolean {
  return isSuited(tile) && (tile.value === 1 || tile.value === 9);
}

/**
 * Return true if tile is a flower tile
 */
export function isFlower(tile: Tile): boolean {
  return tile.suit === 'Flower';
}

/**
 * Check if three tiles form a valid chi (sequence: consecutive values of same suit)
 */
export function isChi(a: Tile, b: Tile, c: Tile): boolean {
  if (a.suit !== b.suit || b.suit !== c.suit) return false;
  if (!isSuited(a)) return false;
  const vals = [a.value, b.value, c.value].sort((x, y) => x - y);
  return vals[1] === vals[0] + 1 && vals[2] === vals[1] + 1;
}

/**
 * Check if three tiles form a valid pong (triplet: same type)
 */
export function isPong(a: Tile, b: Tile, c: Tile): boolean {
  return a.typeIndex === b.typeIndex && b.typeIndex === c.typeIndex;
}

/**
 * Get a canonical string key for a sorted list of typeIndexes (for memoization)
 */
export function tileKey(typeIndexes: number[]): string {
  return [...typeIndexes].sort((a, b) => a - b).join(',');
}

/**
 * Fisher-Yates shuffle (in-place)
 */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Remove one tile by id from array, return new array.
 */
export function removeTileById(tiles: Tile[], id: number): Tile[] {
  const idx = tiles.findIndex(t => t.id === id);
  if (idx === -1) return tiles;
  const result = [...tiles];
  result.splice(idx, 1);
  return result;
}

/**
 * Remove one tile by typeIndex from array (removes first match)
 */
export function removeTileByType(tiles: Tile[], typeIndex: number): Tile[] {
  const idx = tiles.findIndex(t => t.typeIndex === typeIndex);
  if (idx === -1) return tiles;
  const result = [...tiles];
  result.splice(idx, 1);
  return result;
}
