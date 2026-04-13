// ============================================================
// Core Tile Types
// ============================================================

export type Suit = 'Man' | 'Pin' | 'Sou' | 'Wind' | 'Dragon' | 'Flower';

export interface Tile {
  id: number;        // unique 0–139
  typeIndex: number; // 0–37 (tile type, ignoring copy)
  suit: Suit;
  value: number;     // 1–9 for suits; 1–4 for winds; 1–3 for dragons; 1–4 for flowers
  display: string;   // '1萬', '東', '中', '梅', etc.
  copyIndex: number; // 0–3
}

export type MeldType = 'chi' | 'pong' | 'kong' | 'concealed_kong';

export interface Meld {
  type: MeldType;
  tiles: Tile[];             // 3 for chi/pong, 4 for kong
  claimedFrom?: SeatPosition; // direction the claimed tile came from
}

export type SeatPosition = 'bottom' | 'right' | 'top' | 'left';

// ============================================================
// Player & Room
// ============================================================

export interface Player {
  id: string;              // socket.id or 'ai_0' / 'ai_1' / 'ai_2'
  name: string;
  seatIndex: number;       // 0–3 (absolute table seat)
  isAI: boolean;
  hand: Tile[];            // concealed tiles (server has full; client gets own only)
  melds: Meld[];           // revealed melds
  discards: Tile[];        // discard history for this player
  score: number;
  isDealer: boolean;
  flowerTiles: Tile[];     // collected flower tiles
  isReady: boolean;
}

// Public view of a player (sent to all clients — hand is hidden)
export interface PlayerPublic extends Omit<Player, 'hand'> {
  handCount: number; // number of concealed tiles
}

export type GamePhase =
  | 'waiting'        // lobby, waiting for players
  | 'dealing'        // tiles being dealt
  | 'player_turn'    // active player draws & discards
  | 'claim_window'   // other players may claim the discarded tile
  | 'kong_draw'      // player draws extra tile after kong
  | 'round_end'      // someone won or wall exhausted
  | 'game_over';     // all rounds complete

export interface PendingClaim {
  playerId: string;
  seatIndex: number;
  action: 'pong' | 'chi' | 'kong' | 'hu';
  chiTiles?: [number, number]; // two tile IDs that form the sequence with the claimed tile
  priority?: number;           // hu=4, kong=3, pong=2, chi=1 (set by turnController)
}

export interface GameState {
  roomId: string;
  phase: GamePhase;
  round: number;               // 1–4 (East/South/West/North)
  dealerIndex: number;         // 0–3
  activePlayerIndex: number;   // 0–3
  wallTileCount: number;       // remaining tiles in wall
  players: PlayerPublic[];     // index matches seatIndex
  lastDiscard: Tile | null;
  lastDiscardBy: number | null; // seatIndex
  claimDeadline: number | null; // unix timestamp ms
  pendingClaims: PendingClaim[];
  flowerDrawPending: boolean;  // player needs to draw replacement after flower
  round_wind: number;          // 1=East, 2=South, 3=West, 4=North
}

export interface RoomSettings {
  includeFlowers: boolean;
  claimWindowMs: number;  // default 8000
  aiSpeed: number;        // ms before AI acts (default 1200)
  maxRounds: number;      // 4 or 8
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  aiCount: number;
  isStarted: boolean;
  settings: RoomSettings;
}

// ============================================================
// Win Result
// ============================================================

export interface MeldGroup {
  type: 'chi' | 'pong' | 'kong';
  tiles: Tile[];
}

export interface WinResult {
  isWin: boolean;
  hand: Tile[];           // the winning hand tiles
  melds: MeldGroup[];     // how the hand is grouped
  pair: Tile[];           // the pair (雀頭)
  winTile: Tile;          // the tile that completed the hand
  isSelfDraw: boolean;    // 自摸
}

export interface FanItem {
  name: string;
  nameZh: string;
  fan: number;
}

export interface FanBreakdown {
  items: FanItem[];
  totalFan: number;
  basePoints: number;
  finalPoints: number;
}

// ============================================================
// Socket Event Payloads
// ============================================================

export interface C2S_CreateRoomPayload {
  playerName: string;
  roomName: string;
  settings: Partial<RoomSettings>;
}

export interface C2S_JoinRoomPayload {
  roomId: string;
  playerName: string;
}

export interface C2S_DiscardPayload {
  roomId: string;
  tileId: number;
}

export interface C2S_ClaimPayload {
  roomId: string;
  action: 'pong' | 'chi' | 'kong' | 'hu' | 'pass';
  chiTiles?: [number, number]; // the two hand tiles forming a chi sequence
}

export interface C2S_KongPayload {
  roomId: string;
  tileId: number;
  isConcealedKong: boolean;
}

export interface S2C_RoomJoinedPayload {
  room: Room;
  yourSeatIndex: number;
  yourHand: Tile[];
  gameState: GameState;
}

export interface S2C_TileDrawnPayload {
  seatIndex: number;
  tile?: Tile;    // only sent to the player who drew
  newCount: number;
}

export interface S2C_TileDiscardedPayload {
  seatIndex: number;
  tile: Tile;
}

export interface S2C_ClaimWindowPayload {
  deadline: number; // unix ms
  lastDiscard: Tile;
  lastDiscardBy: number;
}

export interface S2C_ClaimAppliedPayload {
  seatIndex: number;
  action: 'pong' | 'chi' | 'kong' | 'hu' | 'pass';
  meld?: Meld;
  newActivePlayerIndex: number;
}

export interface S2C_RoundEndPayload {
  winnerId: string | null;
  winnerSeatIndex: number | null;
  isSelfDraw: boolean;
  fanBreakdown: FanBreakdown | null;
  scoreDeltas: number[];  // per seat
  hands: Tile[][];        // reveal all hands
  reason: 'win' | 'exhausted'; // 和牌 or 荒牌
}

export interface S2C_GameOverPayload {
  finalScores: number[];
  rankings: number[]; // seatIndex sorted by score desc
}

export interface S2C_HandUpdatePayload {
  hand: Tile[];
}
