import { v4 as uuidv4 } from 'uuid';
import { Room, RoomSettings, DEFAULT_SETTINGS } from '@mahjong/shared';
import { ServerPlayer, ServerGameState } from './gameEngine';

// ============================================================
// Server-side Room State (includes full game state)
// ============================================================

export interface ServerRoom extends Omit<Room, 'playerCount' | 'isStarted'> {
  players: ServerPlayer[];
  gameState: ServerGameState | null;
  socketIds: Map<string, number>; // socketId -> seatIndex
}

// ============================================================
// Room Manager
// ============================================================

class RoomManager {
  private rooms = new Map<string, ServerRoom>();

  createRoom(hostSocketId: string, hostName: string, roomName: string, settings: Partial<RoomSettings>): ServerRoom {
    const id = uuidv4().substring(0, 8).toUpperCase();
    const hostPlayer = this.createHumanPlayer(hostSocketId, hostName, 0);

    const room: ServerRoom = {
      id,
      name: roomName || `${hostName}'s Room`,
      hostId: hostSocketId,
      players: [hostPlayer],
      aiCount: 0,
      gameState: null,
      maxPlayers: 4,
      socketIds: new Map([[hostSocketId, 0]]),
      settings: { ...DEFAULT_SETTINGS, ...settings },
    };

    this.rooms.set(id, room);
    return room;
  }

  joinRoom(socketId: string, playerName: string, roomId: string): { room: ServerRoom; seatIndex: number } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.players.length >= 4) return null;
    if (room.gameState) return null; // game already started

    const seatIndex = room.players.length;
    const player = this.createHumanPlayer(socketId, playerName, seatIndex);
    room.players.push(player);
    room.socketIds.set(socketId, seatIndex);

    return { room, seatIndex };
  }

  leaveRoom(socketId: string, roomId: string): ServerRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    room.socketIds.delete(socketId);
    room.players = room.players.filter(p => p.id !== socketId);

    // Re-index seat positions
    room.players.forEach((p, i) => { p.seatIndex = i; });
    room.socketIds.clear();
    room.players.forEach(p => {
      if (!p.isAI) room.socketIds.set(p.id, p.seatIndex);
    });

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    if (room.hostId === socketId && room.players.length > 0) {
      room.hostId = room.players[0].id;
    }

    return room;
  }

  setReady(socketId: string, roomId: string): ServerRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const player = room.players.find(p => p.id === socketId);
    if (player) player.isReady = true;
    return room;
  }

  fillWithAI(roomId: string): ServerRoom | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    let aiIndex = 0;
    while (room.players.length < 4) {
      const seatIndex = room.players.length;
      const aiPlayer: ServerPlayer = {
        id: `ai_${aiIndex}`,
        name: `電腦${aiIndex + 1}`,
        seatIndex,
        isAI: true,
        hand: [],
        melds: [],
        discards: [],
        score: 0,
        isDealer: false,
        flowerTiles: [],
        isReady: true,
      };
      room.players.push(aiPlayer);
      aiIndex++;
      room.aiCount++;
    }
    return room;
  }

  getRoom(roomId: string): ServerRoom | null {
    return this.rooms.get(roomId) ?? null;
  }

  getRoomList(): Room[] {
    return Array.from(this.rooms.values()).map(r => this.toPublicRoom(r));
  }

  toPublicRoom(room: ServerRoom): Room {
    return {
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      playerCount: room.players.length,
      maxPlayers: 4,
      aiCount: room.aiCount,
      isStarted: room.gameState !== null,
      settings: room.settings,
    };
  }

  getSeatIndex(socketId: string, roomId: string): number | null {
    return this.rooms.get(roomId)?.socketIds.get(socketId) ?? null;
  }

  handleDisconnect(socketId: string): string[] {
    const affectedRooms: string[] = [];
    for (const [roomId, room] of this.rooms) {
      if (room.socketIds.has(socketId)) {
        this.leaveRoom(socketId, roomId);
        affectedRooms.push(roomId);
      }
    }
    return affectedRooms;
  }

  private createHumanPlayer(socketId: string, name: string, seatIndex: number): ServerPlayer {
    return {
      id: socketId,
      name: name.substring(0, 16) || `玩家${seatIndex + 1}`,
      seatIndex,
      isAI: false,
      hand: [],
      melds: [],
      discards: [],
      score: 0,
      isDealer: false,
      flowerTiles: [],
      isReady: false,
    };
  }
}

export const roomManager = new RoomManager();
