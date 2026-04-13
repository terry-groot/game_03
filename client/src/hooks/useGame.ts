import { useCallback } from 'react';
import { socket } from '../socket';
import {
  C2S_DISCARD, C2S_CLAIM, C2S_KONG, C2S_READY,
} from '@mahjong/shared';
import { useRoomStore } from '../store/roomStore';
import { useGameStore } from '../store/gameStore';

export function useGame() {
  const { currentRoom, mySeatIndex } = useRoomStore();
  const { gameState, myHand, selectedTileId, selectTile, claimOptions } = useGameStore();

  const isMyTurn = gameState?.activePlayerIndex === mySeatIndex && gameState?.phase === 'player_turn';
  const isClaimWindow = gameState?.phase === 'claim_window';

  const discard = useCallback((tileId: number) => {
    if (!currentRoom || !isMyTurn) return;
    socket.emit(C2S_DISCARD, { roomId: currentRoom.id, tileId });
    selectTile(null);
  }, [currentRoom, isMyTurn, selectTile]);

  const handleTileClick = useCallback((tileId: number) => {
    if (!isMyTurn) return;
    if (selectedTileId === tileId) {
      // Second tap = discard
      discard(tileId);
    } else {
      selectTile(tileId);
    }
  }, [isMyTurn, selectedTileId, discard, selectTile]);

  const claim = useCallback((action: 'pong' | 'chi' | 'kong' | 'hu' | 'pass', chiTiles?: [number, number]) => {
    if (!currentRoom) return;
    socket.emit(C2S_CLAIM, { roomId: currentRoom.id, action, chiTiles });
  }, [currentRoom]);

  const declareKong = useCallback((tileId: number) => {
    if (!currentRoom) return;
    socket.emit(C2S_KONG, { roomId: currentRoom.id, tileId, isConcealedKong: true });
  }, [currentRoom]);

  const declareSelfDrawWin = useCallback(() => {
    if (!currentRoom || !isMyTurn) return;
    socket.emit(C2S_CLAIM, { roomId: currentRoom.id, action: 'hu' });
  }, [currentRoom, isMyTurn]);

  const ready = useCallback(() => {
    if (!currentRoom) return;
    socket.emit(C2S_READY, { roomId: currentRoom.id });
  }, [currentRoom]);

  return {
    isMyTurn,
    isClaimWindow,
    discard,
    handleTileClick,
    claim,
    declareKong,
    declareSelfDrawWin,
    ready,
    claimOptions,
  };
}
