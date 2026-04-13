import { create } from 'zustand';
import { S2C_RoundEndPayload } from '@mahjong/shared';

export type AppView = 'lobby' | 'game';

interface UIStore {
  view: AppView;
  showScoreBoard: boolean;
  roundEndData: S2C_RoundEndPayload | null;
  gameOverData: { finalScores: number[]; rankings: number[] } | null;
  chiPickerOpen: boolean;
  errorMessage: string | null;
  claimTimeoutPct: number;  // 0–100 for countdown arc

  setView: (v: AppView) => void;
  setShowScoreBoard: (show: boolean) => void;
  setRoundEndData: (data: S2C_RoundEndPayload | null) => void;
  setGameOverData: (data: { finalScores: number[]; rankings: number[] } | null) => void;
  setChiPickerOpen: (open: boolean) => void;
  setError: (msg: string | null) => void;
  setClaimTimeoutPct: (pct: number) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  view: 'lobby',
  showScoreBoard: false,
  roundEndData: null,
  gameOverData: null,
  chiPickerOpen: false,
  errorMessage: null,
  claimTimeoutPct: 100,

  setView: (v) => set({ view: v }),
  setShowScoreBoard: (show) => set({ showScoreBoard: show }),
  setRoundEndData: (data) => set({ roundEndData: data }),
  setGameOverData: (data) => set({ gameOverData: data }),
  setChiPickerOpen: (open) => set({ chiPickerOpen: open }),
  setError: (msg) => set({ errorMessage: msg }),
  setClaimTimeoutPct: (pct) => set({ claimTimeoutPct: pct }),
}));
