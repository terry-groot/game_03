import { useEffect, useRef } from 'react';
import { socket } from '../socket';
import {
  S2C_ROOM_LIST, S2C_ROOM_JOINED, S2C_ROOM_UPDATED, S2C_GAME_STARTED,
  S2C_HAND_UPDATE, S2C_GAME_STATE, S2C_TILE_DRAWN, S2C_TILE_DISCARDED,
  S2C_CLAIM_WINDOW, S2C_CLAIM_APPLIED, S2C_TURN_CHANGED, S2C_ROUND_END,
  S2C_GAME_OVER, S2C_ERROR, S2C_FLOWER_DRAWN, S2C_PLAYER_LEFT,
  Room, GameState, Tile,
  getValidChiOptions, computeTenpai, checkWin,
} from '@mahjong/shared';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';
import { useUIStore } from '../store/uiStore';

export function useSocket() {
  const { setRooms, setCurrentRoom, updateCurrentRoom, setMyPlayerId, mySeatIndex } = useRoomStore();
  const {
    setGameState, setMyHand, setClaimOptions, setChiOptions,
    setTenpaiTypes, setLastDrawnTileId,
  } = useGameStore();
  const { setView, setRoundEndData, setGameOverData, setError, setClaimTimeoutPct } = useUIStore();

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    socket.connect();

    socket.on('connect', () => {
      setMyPlayerId(socket.id ?? '');
      socket.emit('c2s:request_rooms');
    });

    socket.on(S2C_ROOM_LIST, (rooms: Room[]) => {
      setRooms(rooms);
    });

    socket.on(S2C_ROOM_JOINED, (payload: {
      room: Room; yourSeatIndex: number; yourHand: Tile[]; gameState: GameState | null;
    }) => {
      setCurrentRoom(payload.room, payload.yourSeatIndex);
      if (payload.yourHand?.length) setMyHand(payload.yourHand);
      if (payload.gameState) setGameState(payload.gameState);
      setView('game');
    });

    socket.on(S2C_ROOM_UPDATED, (room: Room) => {
      updateCurrentRoom(room);
    });

    socket.on(S2C_GAME_STARTED, () => {
      // Server will send S2C_GAME_STATE shortly
    });

    socket.on(S2C_GAME_STATE, (gs: GameState) => {
      setGameState(gs);
    });

    socket.on(S2C_HAND_UPDATE, ({ hand }: { hand: Tile[] }) => {
      setMyHand(hand);
      // Compute tenpai
      const tenpai = computeTenpai(hand, []);
      setTenpaiTypes(tenpai);
    });

    socket.on(S2C_TILE_DRAWN, (payload: { seatIndex: number; tile?: Tile; newCount: number }) => {
      if (payload.tile) {
        setLastDrawnTileId(payload.tile.id);
        setTimeout(() => setLastDrawnTileId(null), 800);
      }
    });

    socket.on(S2C_TILE_DISCARDED, () => {
      setClaimOptions([]);
    });

    socket.on(S2C_CLAIM_WINDOW, (payload: { deadline: number; lastDiscard: Tile }) => {
      // Determine what actions are available based on current hand
      const { myHand } = useGameStore.getState();
      const { mySeatIndex } = useRoomStore.getState();
      const gs = useGameStore.getState().gameState;
      if (!gs) return;

      const options: ('pong' | 'chi' | 'kong' | 'hu')[] = [];

      // Check hu
      const winCheck = checkWin(myHand, [], payload.lastDiscard, false);
      if (winCheck) options.push('hu');

      // Check kong
      const matchCount = myHand.filter(t => t.typeIndex === payload.lastDiscard.typeIndex).length;
      if (matchCount >= 3) options.push('kong');
      if (matchCount >= 2) options.push('pong');

      // Check chi (only from left player = discarderIndex+1)
      const leftPlayerSeat = (gs.lastDiscardBy! + 1) % 4;
      if (mySeatIndex === leftPlayerSeat) {
        const chiOpts = getValidChiOptions(myHand, payload.lastDiscard);
        if (chiOpts.length > 0) {
          options.push('chi');
          setChiOptions(chiOpts.map(([a, b]) => [a.id, b.id] as [number, number]));
        }
      }

      setClaimOptions(options);

      // Start countdown
      if (countdownRef.current) clearInterval(countdownRef.current);
      const end = payload.deadline;
      countdownRef.current = setInterval(() => {
        const remaining = end - Date.now();
        const pct = Math.max(0, (remaining / 8000) * 100);
        setClaimTimeoutPct(pct);
        if (remaining <= 0) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          setClaimOptions([]);
        }
      }, 50);
    });

    socket.on(S2C_CLAIM_APPLIED, () => {
      setClaimOptions([]);
      setChiOptions([]);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    });

    socket.on(S2C_TURN_CHANGED, () => {
      setClaimOptions([]);
    });

    socket.on(S2C_ROUND_END, (payload: any) => {
      setRoundEndData(payload);
      setClaimOptions([]);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    });

    socket.on(S2C_GAME_OVER, (payload: any) => {
      setGameOverData(payload);
    });

    socket.on(S2C_FLOWER_DRAWN, () => {
      // Visual notification handled by game state update
    });

    socket.on(S2C_PLAYER_LEFT, () => {
      // Room updated event will follow
    });

    socket.on(S2C_ERROR, ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(null), 4000);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);
}
