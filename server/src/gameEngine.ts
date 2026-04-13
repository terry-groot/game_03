import {
  Tile, Player, PlayerPublic, GameState, GamePhase, Meld, PendingClaim,
  WinResult, FanBreakdown,
} from '@mahjong/shared';
import {
  buildFullTileSet, getTileById,
  shuffle, sortTiles, removeTileById, removeTileByType,
  countMatchingTiles, checkWin, calculateFan, getValidChiOptions, computeTenpai,
} from '@mahjong/shared';

// ============================================================
// Server-side authoritative game state (includes full hands)
// ============================================================

export interface ServerPlayer extends Omit<Player, 'hand'> {
  hand: Tile[];  // server always has full hand
}

export interface ServerGameState extends Omit<GameState, 'players'> {
  players: ServerPlayer[];
  wall: Tile[];    // remaining wall tiles
  deadWall: Tile[]; // supplemental tiles (嶺上牌) for kongs
  kongCount: number;
}

// ============================================================
// Wall Building & Dealing
// ============================================================

export interface DealResult {
  state: ServerGameState;
}

export function buildWall(includeFlowers: boolean): Tile[] {
  const tiles = buildFullTileSet(includeFlowers);
  return shuffle(tiles);
}

export function createInitialGameState(
  roomId: string,
  players: ServerPlayer[],
  round: number,
  dealerIndex: number,
  includeFlowers: boolean,
  maxRounds: number
): ServerGameState {
  const wall = buildWall(includeFlowers);

  // Reserve last 14 tiles as dead wall (for kong draws)
  const deadWall = wall.splice(wall.length - 14, 14);

  // Deal 16 tiles to each player
  const hands: Tile[][] = [[], [], [], []];
  for (let i = 0; i < 16; i++) {
    for (let p = 0; p < 4; p++) {
      const tile = wall.pop()!;
      hands[p].push(tile);
    }
  }

  // Handle flower tiles in initial deal
  const updatedPlayers = players.map((p, i) => ({
    ...p,
    hand: sortTiles(hands[i].filter(t => t.suit !== 'Flower')),
    flowerTiles: hands[i].filter(t => t.suit === 'Flower'),
    melds: [],
    discards: [],
    isDealer: i === dealerIndex,
  }));

  // Determine round wind
  const roundWind = ((round - 1) % 4) + 1;

  return {
    roomId,
    phase: 'player_turn',
    round,
    dealerIndex,
    activePlayerIndex: dealerIndex,
    wallTileCount: wall.length,
    players: updatedPlayers,
    wall,
    deadWall,
    lastDiscard: null,
    lastDiscardBy: null,
    claimDeadline: null,
    pendingClaims: [],
    flowerDrawPending: false,
    round_wind: roundWind,
    kongCount: 0,
  };
}

// ============================================================
// State Transitions (pure functions)
// ============================================================

export function drawTile(state: ServerGameState, seatIndex: number): {
  state: ServerGameState;
  drawnTile: Tile;
} {
  if (state.wall.length === 0) {
    throw new Error('Wall is empty');
  }
  const newWall = [...state.wall];
  const drawnTile = newWall.pop()!;
  const newPlayers = state.players.map((p, i) => {
    if (i !== seatIndex) return p;
    return {
      ...p,
      hand: sortTiles([...p.hand, drawnTile]),
    };
  });
  return {
    drawnTile,
    state: {
      ...state,
      wall: newWall,
      wallTileCount: newWall.length,
      players: newPlayers,
      phase: 'player_turn',
      activePlayerIndex: seatIndex,
    },
  };
}

export function drawFromDeadWall(state: ServerGameState, seatIndex: number): {
  state: ServerGameState;
  drawnTile: Tile;
} {
  if (state.deadWall.length === 0) throw new Error('Dead wall is empty');
  const newDeadWall = [...state.deadWall];
  const drawnTile = newDeadWall.shift()!; // draw from front of dead wall
  const newPlayers = state.players.map((p, i) => {
    if (i !== seatIndex) return p;
    return { ...p, hand: sortTiles([...p.hand, drawnTile]) };
  });
  return {
    drawnTile,
    state: {
      ...state,
      deadWall: newDeadWall,
      players: newPlayers,
      phase: 'player_turn',
      activePlayerIndex: seatIndex,
    },
  };
}

export function discardTile(state: ServerGameState, seatIndex: number, tileId: number): ServerGameState {
  const player = state.players[seatIndex];
  const tile = player.hand.find(t => t.id === tileId);
  if (!tile) throw new Error(`Tile ${tileId} not in player ${seatIndex} hand`);

  const newPlayers = state.players.map((p, i) => {
    if (i !== seatIndex) return p;
    return {
      ...p,
      hand: removeTileById(p.hand, tileId),
      discards: [...p.discards, tile],
    };
  });

  return {
    ...state,
    players: newPlayers,
    phase: 'claim_window',
    lastDiscard: tile,
    lastDiscardBy: seatIndex,
    pendingClaims: [],
    claimDeadline: Date.now() + 8000, // will be set by turnController
  };
}

export function applyPong(state: ServerGameState, seatIndex: number): ServerGameState {
  const discard = state.lastDiscard!;
  const player = state.players[seatIndex];
  const matchingTiles = player.hand.filter(t => t.typeIndex === discard.typeIndex);
  if (matchingTiles.length < 2) throw new Error('Not enough tiles for pong');

  const meldTiles = [matchingTiles[0], matchingTiles[1], discard];
  const meld: Meld = { type: 'pong', tiles: meldTiles };

  const newHand = removeTileByType(removeTileByType(player.hand, discard.typeIndex), discard.typeIndex);

  const newPlayers = state.players.map((p, i) => {
    if (i !== seatIndex) return p;
    return { ...p, hand: newHand, melds: [...p.melds, meld] };
  });

  return {
    ...state,
    players: newPlayers,
    phase: 'player_turn',
    activePlayerIndex: seatIndex,
    lastDiscard: null,
    claimDeadline: null,
    pendingClaims: [],
  };
}

export function applyChi(state: ServerGameState, seatIndex: number, chiTiles: [number, number]): ServerGameState {
  const discard = state.lastDiscard!;
  const player = state.players[seatIndex];

  const tile1 = player.hand.find(t => t.id === chiTiles[0]);
  const tile2 = player.hand.find(t => t.id === chiTiles[1]);
  if (!tile1 || !tile2) throw new Error('Chi tiles not found in hand');

  const meldTiles = sortTiles([tile1, tile2, discard]);
  const meld: Meld = {
    type: 'chi',
    tiles: meldTiles,
    claimedFrom: 'left', // chi is always from left player
  };

  const newHand = removeTileById(removeTileById(player.hand, chiTiles[0]), chiTiles[1]);

  const newPlayers = state.players.map((p, i) => {
    if (i !== seatIndex) return p;
    return { ...p, hand: newHand, melds: [...p.melds, meld] };
  });

  return {
    ...state,
    players: newPlayers,
    phase: 'player_turn',
    activePlayerIndex: seatIndex,
    lastDiscard: null,
    claimDeadline: null,
    pendingClaims: [],
  };
}

export function applyKongFromDiscard(state: ServerGameState, seatIndex: number): ServerGameState {
  const discard = state.lastDiscard!;
  const player = state.players[seatIndex];
  const matchingTiles = player.hand.filter(t => t.typeIndex === discard.typeIndex);
  if (matchingTiles.length < 3) throw new Error('Not enough tiles for kong');

  const meldTiles = [...matchingTiles.slice(0, 3), discard];
  const meld: Meld = { type: 'kong', tiles: meldTiles };

  let newHand = player.hand;
  for (let i = 0; i < 3; i++) {
    newHand = removeTileByType(newHand, discard.typeIndex);
  }

  const newPlayers = state.players.map((p, i) => {
    if (i !== seatIndex) return p;
    return { ...p, hand: newHand, melds: [...p.melds, meld] };
  });

  return {
    ...state,
    players: newPlayers,
    phase: 'kong_draw',
    activePlayerIndex: seatIndex,
    lastDiscard: null,
    claimDeadline: null,
    pendingClaims: [],
    kongCount: state.kongCount + 1,
  };
}

export function applyConcealedKong(state: ServerGameState, seatIndex: number, tileId: number): ServerGameState {
  const player = state.players[seatIndex];
  const tile = player.hand.find(t => t.id === tileId)!;
  const matchingTiles = player.hand.filter(t => t.typeIndex === tile.typeIndex);
  if (matchingTiles.length < 4) throw new Error('Not enough tiles for concealed kong');

  const meld: Meld = { type: 'concealed_kong', tiles: matchingTiles };
  let newHand = player.hand;
  for (let i = 0; i < 4; i++) {
    newHand = removeTileByType(newHand, tile.typeIndex);
  }

  const newPlayers = state.players.map((p, i) => {
    if (i !== seatIndex) return p;
    return { ...p, hand: newHand, melds: [...p.melds, meld] };
  });

  return {
    ...state,
    players: newPlayers,
    phase: 'kong_draw',
    activePlayerIndex: seatIndex,
    kongCount: state.kongCount + 1,
  };
}

export function collectFlower(state: ServerGameState, seatIndex: number, tileId: number): ServerGameState {
  const player = state.players[seatIndex];
  const tile = player.hand.find(t => t.id === tileId);
  if (!tile || tile.suit !== 'Flower') throw new Error('Not a flower tile');

  const newPlayers = state.players.map((p, i) => {
    if (i !== seatIndex) return p;
    return {
      ...p,
      hand: removeTileById(p.hand, tileId),
      flowerTiles: [...p.flowerTiles, tile],
    };
  });

  return {
    ...state,
    players: newPlayers,
    flowerDrawPending: true,
  };
}

export function nextPlayerIndex(current: number): number {
  return (current + 1) % 4;
}

/**
 * Convert ServerGameState to public GameState (hide opponent hands)
 */
export function toPublicState(state: ServerGameState): GameState {
  return {
    ...state,
    players: state.players.map(p => ({
      ...p,
      hand: [] as Tile[],      // hide from public
      handCount: p.hand.length, // only expose count
    })) as unknown as import('@mahjong/shared').PlayerPublic[],
  };
}

/**
 * Check if the wall is exhausted (荒牌)
 */
export function isWallExhausted(state: ServerGameState): boolean {
  return state.wall.length === 0;
}

/**
 * Apply win to state, returning updated scores
 */
export function applyWin(
  state: ServerGameState,
  winnerSeatIndex: number,
  fanBreakdown: FanBreakdown,
  isSelfDraw: boolean
): { state: ServerGameState; scoreDeltas: number[] } {
  const points = fanBreakdown.finalPoints;
  const scoreDeltas = [0, 0, 0, 0];

  if (isSelfDraw) {
    // All others pay
    for (let i = 0; i < 4; i++) {
      if (i !== winnerSeatIndex) {
        scoreDeltas[i] = -points;
        scoreDeltas[winnerSeatIndex] += points;
      }
    }
  } else {
    // Discarder pays
    const discarderIndex = state.lastDiscardBy!;
    scoreDeltas[discarderIndex] = -points * 2;
    scoreDeltas[winnerSeatIndex] = points * 2;
  }

  const newPlayers = state.players.map((p, i) => ({
    ...p,
    score: p.score + scoreDeltas[i],
  }));

  return {
    scoreDeltas,
    state: { ...state, players: newPlayers, phase: 'round_end' },
  };
}
