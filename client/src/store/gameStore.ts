import { create } from 'zustand';
import { GameState, Tile } from '@mahjong/shared';

interface GameStore {
  gameState: GameState | null;
  myHand: Tile[];
  selectedTileId: number | null;
  claimOptions: ('pong' | 'chi' | 'kong' | 'hu')[];
  chiOptions: [number, number][];  // available chi tile combos
  tenpaiTypes: number[];           // typeIndexes that would win
  lastDrawnTileId: number | null;  // for animation

  setGameState: (gs: GameState) => void;
  setMyHand: (hand: Tile[]) => void;
  selectTile: (id: number | null) => void;
  setClaimOptions: (opts: ('pong' | 'chi' | 'kong' | 'hu')[]) => void;
  setChiOptions: (opts: [number, number][]) => void;
  setTenpaiTypes: (types: number[]) => void;
  setLastDrawnTileId: (id: number | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameState: null,
  myHand: [],
  selectedTileId: null,
  claimOptions: [],
  chiOptions: [],
  tenpaiTypes: [],
  lastDrawnTileId: null,

  setGameState: (gs) => set({ gameState: gs }),
  setMyHand: (hand) => set({ myHand: hand }),
  selectTile: (id) => set({ selectedTileId: id }),
  setClaimOptions: (opts) => set({ claimOptions: opts }),
  setChiOptions: (opts) => set({ chiOptions: opts }),
  setTenpaiTypes: (types) => set({ tenpaiTypes: types }),
  setLastDrawnTileId: (id) => set({ lastDrawnTileId: id }),
  reset: () => set({
    gameState: null, myHand: [], selectedTileId: null,
    claimOptions: [], chiOptions: [], tenpaiTypes: [], lastDrawnTileId: null,
  }),
}));
