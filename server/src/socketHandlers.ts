import { Server as SocketServer, Socket } from 'socket.io';
import {
  C2S_CREATE_ROOM, C2S_JOIN_ROOM, C2S_LEAVE_ROOM, C2S_READY,
  C2S_DISCARD, C2S_CLAIM, C2S_KONG, C2S_REQUEST_ROOMS,
  S2C_ROOM_LIST, S2C_ROOM_JOINED, S2C_ROOM_UPDATED, S2C_PLAYER_LEFT,
  S2C_GAME_STARTED, S2C_ERROR, S2C_HAND_UPDATE, S2C_GAME_STATE,
  C2S_CreateRoomPayload, C2S_JoinRoomPayload, C2S_DiscardPayload,
  C2S_ClaimPayload, C2S_KongPayload,
} from '@mahjong/shared';
import { roomManager } from './roomManager';
import { toPublicState } from './gameEngine';
import { TurnController } from './turnController';

// ============================================================
// Socket.io Event Handlers
// ============================================================

export function registerHandlers(io: SocketServer): void {
  const turnCtrl = new TurnController(io);

  io.on('connection', (socket: Socket) => {
    console.log(`Connected: ${socket.id}`);

    // ---- Room List ----
    socket.on(C2S_REQUEST_ROOMS, () => {
      socket.emit(S2C_ROOM_LIST, roomManager.getRoomList());
    });

    // ---- Create Room ----
    socket.on(C2S_CREATE_ROOM, (payload: C2S_CreateRoomPayload) => {
      try {
        const room = roomManager.createRoom(
          socket.id,
          payload.playerName,
          payload.roomName,
          payload.settings ?? {}
        );
        socket.join(room.id);

        const gs = room.gameState ? toPublicState(room.gameState) : null;
        socket.emit(S2C_ROOM_JOINED, {
          room: roomManager.toPublicRoom(room),
          yourSeatIndex: 0,
          yourHand: [],
          gameState: gs,
        });

        // Broadcast updated room list
        io.emit(S2C_ROOM_LIST, roomManager.getRoomList());
      } catch (e) {
        socket.emit(S2C_ERROR, { message: String(e), code: 'CREATE_ROOM_FAILED' });
      }
    });

    // ---- Join Room ----
    socket.on(C2S_JOIN_ROOM, (payload: C2S_JoinRoomPayload) => {
      try {
        const result = roomManager.joinRoom(socket.id, payload.playerName, payload.roomId);
        if (!result) {
          socket.emit(S2C_ERROR, { message: '無法加入房間', code: 'JOIN_FAILED' });
          return;
        }
        const { room, seatIndex } = result;
        socket.join(room.id);

        const gs = room.gameState ? toPublicState(room.gameState) : null;
        socket.emit(S2C_ROOM_JOINED, {
          room: roomManager.toPublicRoom(room),
          yourSeatIndex: seatIndex,
          yourHand: gs ? room.gameState!.players[seatIndex].hand : [],
          gameState: gs,
        });

        // Notify others in room
        socket.to(room.id).emit(S2C_ROOM_UPDATED, roomManager.toPublicRoom(room));
        io.emit(S2C_ROOM_LIST, roomManager.getRoomList());
      } catch (e) {
        socket.emit(S2C_ERROR, { message: String(e), code: 'JOIN_FAILED' });
      }
    });

    // ---- Leave Room ----
    socket.on(C2S_LEAVE_ROOM, ({ roomId }: { roomId: string }) => {
      const room = roomManager.leaveRoom(socket.id, roomId);
      socket.leave(roomId);
      if (room) {
        io.to(roomId).emit(S2C_PLAYER_LEFT, { socketId: socket.id });
        io.to(roomId).emit(S2C_ROOM_UPDATED, roomManager.toPublicRoom(room));
      }
      io.emit(S2C_ROOM_LIST, roomManager.getRoomList());
    });

    // ---- Ready ----
    socket.on(C2S_READY, ({ roomId }: { roomId: string }) => {
      const room = roomManager.setReady(socket.id, roomId);
      if (!room) return;

      io.to(roomId).emit(S2C_ROOM_UPDATED, roomManager.toPublicRoom(room));

      // Auto-start when all human players are ready and room has ≥2 players (fill rest with AI)
      const humanPlayers = room.players.filter(p => !p.isAI);
      const allReady = humanPlayers.every(p => p.isReady);
      if (allReady && humanPlayers.length >= 1) {
        // Fill with AI
        if (room.players.length < 4) {
          roomManager.fillWithAI(roomId);
        }
        io.to(roomId).emit(S2C_GAME_STARTED, {});
        turnCtrl.startGame(room);
      }
    });

    // ---- Discard ----
    socket.on(C2S_DISCARD, (payload: C2S_DiscardPayload) => {
      const room = roomManager.getRoom(payload.roomId);
      if (!room || !room.gameState) return;

      const seatIndex = roomManager.getSeatIndex(socket.id, payload.roomId);
      if (seatIndex === null) return;

      turnCtrl.playerDiscard(room, seatIndex, payload.tileId);
    });

    // ---- Claim (Pong/Chi/Kong/Hu/Pass) ----
    socket.on(C2S_CLAIM, (payload: C2S_ClaimPayload) => {
      const room = roomManager.getRoom(payload.roomId);
      if (!room || !room.gameState) return;

      const seatIndex = roomManager.getSeatIndex(socket.id, payload.roomId);
      if (seatIndex === null) return;

      if (payload.action === 'hu') {
        // Self-draw hu (handled separately by client sending C2S_CLAIM with action=hu)
        const state = room.gameState;
        if (state.activePlayerIndex === seatIndex && state.phase === 'player_turn') {
          turnCtrl.playerSelfDrawWin(room, seatIndex);
          return;
        }
      }

      turnCtrl.submitClaim(room, seatIndex, payload.action, payload.chiTiles);
    });

    // ---- Kong ----
    socket.on(C2S_KONG, (payload: C2S_KongPayload) => {
      const room = roomManager.getRoom(payload.roomId);
      if (!room || !room.gameState) return;

      const seatIndex = roomManager.getSeatIndex(socket.id, payload.roomId);
      if (seatIndex === null) return;

      turnCtrl.playerKong(room, seatIndex, payload.tileId, payload.isConcealedKong);
    });

    // ---- Disconnect ----
    socket.on('disconnect', () => {
      console.log(`Disconnected: ${socket.id}`);
      const affectedRooms = roomManager.handleDisconnect(socket.id);
      for (const roomId of affectedRooms) {
        const room = roomManager.getRoom(roomId);
        if (room) {
          io.to(roomId).emit(S2C_PLAYER_LEFT, { socketId: socket.id });
          io.to(roomId).emit(S2C_ROOM_UPDATED, roomManager.toPublicRoom(room));
        }
      }
      if (affectedRooms.length > 0) {
        io.emit(S2C_ROOM_LIST, roomManager.getRoomList());
      }
    });
  });
}
