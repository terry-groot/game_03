import type { Suit, Tile } from './types';

// ============================================================
// Tile Type Definitions
// typeIndex:
//   0–8:   Man  (萬) value 1–9
//   9–17:  Pin  (餅) value 1–9
//   18–26: Sou  (索) value 1–9
//   27–30: Wind (風) value 1=East, 2=South, 3=West, 4=North
//   31–33: Dragon (三元) value 1=中, 2=發, 3=白
//   34–37: Flower (花) value 1–4 (梅蘭菊竹 or 春夏秋冬)
// ============================================================

const SUIT_CHARS: Record<string, string> = {
  Man:    '萬',
  Pin:    '餅',
  Sou:    '索',
};

const WIND_CHARS = ['東', '南', '西', '北'];
const DRAGON_CHARS = ['中', '發', '白'];
const FLOWER_CHARS = ['梅', '蘭', '菊', '竹'];
const NUM_CHARS = ['一','二','三','四','五','六','七','八','九'];

function buildSuitTiles(suit: 'Man' | 'Pin' | 'Sou', baseTypeIndex: number, tiles: Tile[]): void {
  for (let value = 1; value <= 9; value++) {
    const typeIndex = baseTypeIndex + (value - 1);
    const display = `${value}${SUIT_CHARS[suit]}`;
    for (let copyIndex = 0; copyIndex < 4; copyIndex++) {
      tiles.push({
        id: typeIndex * 4 + copyIndex,
        typeIndex,
        suit,
        value,
        display,
        copyIndex,
      });
    }
  }
}

function buildHonorTiles(tiles: Tile[]): void {
  // Winds: typeIndex 27–30
  for (let i = 0; i < 4; i++) {
    const typeIndex = 27 + i;
    for (let copyIndex = 0; copyIndex < 4; copyIndex++) {
      tiles.push({
        id: typeIndex * 4 + copyIndex,
        typeIndex,
        suit: 'Wind' as Suit,
        value: i + 1,
        display: WIND_CHARS[i],
        copyIndex,
      });
    }
  }
  // Dragons: typeIndex 31–33
  for (let i = 0; i < 3; i++) {
    const typeIndex = 31 + i;
    for (let copyIndex = 0; copyIndex < 4; copyIndex++) {
      tiles.push({
        id: typeIndex * 4 + copyIndex,
        typeIndex,
        suit: 'Dragon' as Suit,
        value: i + 1,
        display: DRAGON_CHARS[i],
        copyIndex,
      });
    }
  }
}

function buildFlowerTiles(tiles: Tile[]): void {
  // Flowers: typeIndex 34–37, one copy each (id = 136–139)
  for (let i = 0; i < 4; i++) {
    const typeIndex = 34 + i;
    tiles.push({
      id: 136 + i,
      typeIndex,
      suit: 'Flower' as Suit,
      value: i + 1,
      display: FLOWER_CHARS[i],
      copyIndex: 0,
    });
  }
}

export function buildFullTileSet(includeFlowers: boolean): Tile[] {
  const tiles: Tile[] = [];
  buildSuitTiles('Man', 0, tiles);
  buildSuitTiles('Pin', 9, tiles);
  buildSuitTiles('Sou', 18, tiles);
  buildHonorTiles(tiles);
  if (includeFlowers) {
    buildFlowerTiles(tiles);
  }
  return tiles;
}

// Pre-built lookup map: id -> Tile (for 136 + 4 flower tiles)
let _tileMap: Map<number, Tile> | null = null;

export function getTileMap(includeFlowers = true): Map<number, Tile> {
  if (!_tileMap) {
    _tileMap = new Map();
    const allTiles = buildFullTileSet(true);
    for (const t of allTiles) {
      _tileMap.set(t.id, t);
    }
  }
  return _tileMap;
}

export function getTileById(id: number): Tile {
  const map = getTileMap();
  const tile = map.get(id);
  if (!tile) throw new Error(`Unknown tile id: ${id}`);
  return tile;
}

// Constant for easy reference
export const SUIT_ORDER: Suit[] = ['Man', 'Pin', 'Sou', 'Wind', 'Dragon', 'Flower'];

export const DEFAULT_SETTINGS = {
  includeFlowers: true,
  claimWindowMs: 8000,
  aiSpeed: 1200,
  maxRounds: 4,
};

export { NUM_CHARS, WIND_CHARS, DRAGON_CHARS };
