import { Server as SocketServer } from 'socket.io';
import {
  S2C_TILE_DRAWN, S2C_TILE_DISCARDED, S2C_CLAIM_WINDOW,
  S2C_CLAIM_APPLIED, S2C_TURN_CHANGED, S2C_KONG_DRAW, S2C_ROUND_END,
  S2C_GAME_STATE, S2C_HAND_UPDATE, S2C_FLOWER_DRAWN, S2C_GAME_OVER,
} from '@mahjong/shared';
import { checkWin, calculateFan, computeTenpai } from '@mahjong/shared';
import {
  ServerGameState, drawTile, drawFromDeadWall, discardTile,
  applyPong, applyChi, applyKongFromDiscard, applyConcealedKong,
  collectFlower, nextPlayerIndex, toPublicState, isWallExhausted, applyWin,
  createInitialGameState,
} from './gameEngine';
import { ServerRoom, roomManager } from './roomManager';
import { decideDiscard, decideClaim, decideConcealedKong } from './aiPlayer';

// ============================================================
// Turn Controller
// Orchestrates game flow, timers, and AI actions
// ============================================================

export class TurnController {
  private io: SocketServer;
  private claimTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private aiTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(io: SocketServer) {
    this.io = io;
  }

  // ---- Game Start ----

  startGame(room: ServerRoom): void {
    const { roomId: rid, players } = { roomId: room.id, players: room.players };

    // Fill with AI if needed
    if (room.players.length < 4) {
      roomManager.fillWithAI(room.id);
    }

    const state = createInitialGameState(
      room.id,
      room.players,
      1,
      0, // dealer = seat 0 initially
      room.settings.includeFlowers,
      room.settings.maxRounds
    );
    room.gameState = state;

    // Broadcast public state
    this.broadcastState(room);

    // Send private hand to each human
    this.sendPrivateHands(room);

    // Resolve flowers drawn in initial deal
    this.resolveInitialFlowers(room);

    // Start dealer's turn
    this.startPlayerTurn(room, state.dealerIndex);
  }

  startNextRound(room: ServerRoom): void {
    const prev = room.gameState!;
    const nextDealer = nextPlayerIndex(prev.dealerIndex);
    const nextRound = prev.round + 1;

    if (nextRound > room.settings.maxRounds) {
      this.endGame(room);
      return;
    }

    const state = createInitialGameState(
      room.id,
      room.players,
      nextRound,
      nextDealer,
      room.settings.includeFlowers,
      room.settings.maxRounds
    );
    room.gameState = state;

    this.broadcastState(room);
    this.sendPrivateHands(room);
    this.resolveInitialFlowers(room);
    this.startPlayerTurn(room, nextDealer);
  }

  endGame(room: ServerRoom): void {
    const state = room.gameState!;
    const scores = state.players.map(p => p.score);
    const rankings = scores
      .map((s, i) => ({ score: s, seat: i }))
      .sort((a, b) => b.score - a.score)
      .map(x => x.seat);

    this.io.to(room.id).emit(S2C_GAME_OVER, {
      finalScores: scores,
      rankings,
    });
    room.gameState = null;
  }

  // ---- Player Turn ----

  startPlayerTurn(room: ServerRoom, seatIndex: number): void {
    const state = room.gameState!;
    if (isWallExhausted(state)) {
      this.endRoundExhausted(room);
      return;
    }

    const { state: newState, drawnTile } = drawTile(state, seatIndex);
    room.gameState = newState;

    // Broadcast turn change + drawn tile count
    this.io.to(room.id).emit(S2C_TILE_DRAWN, {
      seatIndex,
      newCount: newState.players[seatIndex].hand.length,
    });
    this.io.to(room.id).emit(S2C_TURN_CHANGED, { activePlayerIndex: seatIndex });

    // Send drawn tile privately to the drawing player
    const playerSocketId = room.players[seatIndex].id;
    if (!room.players[seatIndex].isAI) {
      this.io.to(playerSocketId).emit(S2C_TILE_DRAWN, { seatIndex, tile: drawnTile, newCount: newState.players[seatIndex].hand.length });
      this.sendPrivateHand(room, seatIndex);
    }

    // Handle flower tiles
    const flowers = newState.players[seatIndex].hand.filter(t => t.suit === 'Flower');
    if (flowers.length > 0) {
      this.handleFlowerDraw(room, seatIndex, flowers[0].id);
      return;
    }

    // AI turn
    if (room.players[seatIndex].isAI) {
      this.scheduleAITurn(room, seatIndex);
    }
    // Human player waits for C2S_DISCARD
  }

  handleFlowerDraw(room: ServerRoom, seatIndex: number, tileId: number): void {
    const state = collectFlower(room.gameState!, seatIndex, tileId);
    room.gameState = state;

    const flower = room.gameState.players[seatIndex].flowerTiles.at(-1)!;
    this.io.to(room.id).emit(S2C_FLOWER_DRAWN, { seatIndex, flower });

    // Draw replacement from dead wall
    if (room.gameState.deadWall.length > 0) {
      const { state: stateAfterDraw, drawnTile } = drawFromDeadWall(room.gameState, seatIndex);
      room.gameState = stateAfterDraw;

      if (!room.players[seatIndex].isAI) {
        this.io.to(room.players[seatIndex].id).emit(S2C_TILE_DRAWN, {
          seatIndex, tile: drawnTile,
          newCount: stateAfterDraw.players[seatIndex].hand.length,
        });
        this.sendPrivateHand(room, seatIndex);
      }

      // Check for more flowers
      const moreFlowers = room.gameState.players[seatIndex].hand.filter(t => t.suit === 'Flower');
      if (moreFlowers.length > 0) {
        this.handleFlowerDraw(room, seatIndex, moreFlowers[0].id);
        return;
      }
    }

    if (room.players[seatIndex].isAI) {
      this.scheduleAITurn(room, seatIndex);
    }
  }

  playerDiscard(room: ServerRoom, seatIndex: number, tileId: number): void {
    const state = room.gameState!;
    if (state.activePlayerIndex !== seatIndex || state.phase !== 'player_turn') {
      return;
    }

    try {
      const newState = discardTile(state, seatIndex, tileId);
      const discardedTile = newState.lastDiscard!;
      newState.claimDeadline = Date.now() + room.settings.claimWindowMs;
      room.gameState = newState;

      this.io.to(room.id).emit(S2C_TILE_DISCARDED, { seatIndex, tile: discardedTile });
      this.broadcastState(room);

      // Open claim window
      this.openClaimWindow(room);
    } catch (e) {
      console.error('Discard error:', e);
    }
  }

  playerKong(room: ServerRoom, seatIndex: number, tileId: number, isConcealedKong: boolean): void {
    try {
      let newState: ServerGameState;
      if (isConcealedKong) {
        newState = applyConcealedKong(room.gameState!, seatIndex, tileId);
      } else {
        // Add to existing pong meld (upgrade pong → kong)
        // For simplicity treat as concealed kong in this version
        newState = applyConcealedKong(room.gameState!, seatIndex, tileId);
      }
      room.gameState = newState;
      this.io.to(room.id).emit(S2C_KONG_DRAW, { seatIndex });
      this.broadcastState(room);
      this.startKongDraw(room, seatIndex);
    } catch (e) {
      console.error('Kong error:', e);
    }
  }

  startKongDraw(room: ServerRoom, seatIndex: number): void {
    const state = room.gameState!;
    if (state.deadWall.length === 0) {
      this.endRoundExhausted(room);
      return;
    }
    const { state: newState, drawnTile } = drawFromDeadWall(state, seatIndex);
    room.gameState = newState;

    if (!room.players[seatIndex].isAI) {
      this.io.to(room.players[seatIndex].id).emit(S2C_TILE_DRAWN, {
        seatIndex, tile: drawnTile,
        newCount: newState.players[seatIndex].hand.length,
      });
      this.sendPrivateHand(room, seatIndex);
    }

    if (room.players[seatIndex].isAI) {
      this.scheduleAITurn(room, seatIndex);
    }
  }

  // ---- Claim Window ----

  openClaimWindow(room: ServerRoom): void {
    const state = room.gameState!;
    const deadline = state.claimDeadline!;

    this.io.to(room.id).emit(S2C_CLAIM_WINDOW, {
      deadline,
      lastDiscard: state.lastDiscard,
      lastDiscardBy: state.lastDiscardBy,
    });

    // Schedule AI claim decisions
    for (const player of room.players) {
      if (player.isAI && player.seatIndex !== state.lastDiscardBy) {
        const canChi = player.seatIndex === nextPlayerIndex(state.lastDiscardBy!);
        const delay = room.settings.aiSpeed + Math.random() * 400;
        const timer = setTimeout(() => {
          this.processAIClaim(room, player.seatIndex, canChi);
        }, delay);
        this.aiTimers.set(`${room.id}_ai_${player.seatIndex}`, timer);
      }
    }

    // Claim window timeout
    const remaining = deadline - Date.now();
    const timer = setTimeout(() => {
      this.resolveClaimWindow(room);
    }, remaining);
    this.claimTimers.set(room.id, timer);
  }

  submitClaim(
    room: ServerRoom,
    seatIndex: number,
    action: 'pong' | 'chi' | 'kong' | 'hu' | 'pass',
    chiTiles?: [number, number]
  ): void {
    const state = room.gameState!;
    if (state.phase !== 'claim_window') return;
    if (seatIndex === state.lastDiscardBy) return;

    if (action === 'pass') {
      // Mark this player as passed
      const alreadyClaimed = state.pendingClaims.some(c => c.seatIndex === seatIndex);
      if (!alreadyClaimed) {
        room.gameState = {
          ...state,
          pendingClaims: [...state.pendingClaims, { playerId: room.players[seatIndex].id, seatIndex, action: 'pong', chiTiles }],
        };
      }
      // Check if all non-discarder players have responded
      // All 3 other players responded
      if (room.gameState != null &&
          room.gameState.pendingClaims.filter(c => c.action === 'pong').length === 0 &&
          room.gameState.pendingClaims.length === 3) {
        this.resolveClaimWindow(room);
      }
      return;
    }

    // Add claim with priority
    const priority = action === 'hu' ? 4 : action === 'kong' ? 3 : action === 'pong' ? 2 : 1;
    const newClaim = {
      playerId: room.players[seatIndex].id,
      seatIndex,
      action,
      priority,
      chiTiles,
    };

    room.gameState = {
      ...state,
      pendingClaims: [...state.pendingClaims, newClaim],
    };

    // If someone claims hu, resolve immediately
    if (action === 'hu') {
      this.clearClaimTimer(room.id);
      this.resolveClaimWindow(room);
    }
  }

  resolveClaimWindow(room: ServerRoom): void {
    this.clearClaimTimer(room.id);
    this.clearAITimers(room.id);

    const state = room.gameState!;
    if (state.phase !== 'claim_window') return;

    const claims = state.pendingClaims;

    // Pick highest priority claim; tiebreak by seat order (closest to discarder)
    if (claims.length === 0) {
      // No claims, next player draws
      const nextPlayer = nextPlayerIndex(state.lastDiscardBy!);
      this.startPlayerTurn(room, nextPlayer);
      return;
    }

    const sorted = [...claims].sort((a, b) => {
      const ap = a.priority ?? 0;
      const bp = b.priority ?? 0;
      if (bp !== ap) return bp - ap;
      return 0;
    });

    const winner = sorted[0];
    this.applyClaim(room, winner.seatIndex, winner.action, winner.chiTiles);
  }

  applyClaim(room: ServerRoom, seatIndex: number, action: string, chiTiles?: [number, number]): void {
    const state = room.gameState!;
    const player = state.players[seatIndex];

    try {
      if (action === 'hu') {
        // Win!
        const winTile = state.lastDiscard!;
        const winResult = checkWin(player.hand, player.melds, winTile, false);
        if (!winResult) {
          // False hu claim, skip
          this.resolveClaimWindow(room);
          return;
        }
        const fanBreakdown = calculateFan({
          isSelfDraw: false,
          isDealer: player.isDealer,
          revealedMelds: player.melds,
          flowerCount: player.flowerTiles.length,
          roundWind: state.round_wind,
          seatWind: seatIndex + 1,
          winResult,
        });
        const { state: newState, scoreDeltas } = applyWin(state, seatIndex, fanBreakdown, false);
        room.gameState = newState;

        this.io.to(room.id).emit(S2C_ROUND_END, {
          winnerId: player.id,
          winnerSeatIndex: seatIndex,
          isSelfDraw: false,
          fanBreakdown,
          scoreDeltas,
          hands: room.gameState.players.map(p => p.hand),
          reason: 'win',
        });

        setTimeout(() => this.startNextRound(room), 5000);
        return;
      }

      if (action === 'pong') {
        room.gameState = applyPong(state, seatIndex);
      } else if (action === 'chi' && chiTiles) {
        room.gameState = applyChi(state, seatIndex, chiTiles);
      } else if (action === 'kong') {
        room.gameState = applyKongFromDiscard(state, seatIndex);
        this.io.to(room.id).emit(S2C_CLAIM_APPLIED, {
          seatIndex, action, newActivePlayerIndex: seatIndex,
        });
        this.broadcastState(room);
        this.sendPrivateHand(room, seatIndex);
        this.startKongDraw(room, seatIndex);
        return;
      }

      this.io.to(room.id).emit(S2C_CLAIM_APPLIED, {
        seatIndex,
        action,
        newActivePlayerIndex: seatIndex,
      });
      this.broadcastState(room);
      this.sendPrivateHand(room, seatIndex);

      // Now it's the claiming player's turn to discard
      if (room.players[seatIndex].isAI) {
        this.scheduleAITurn(room, seatIndex);
      }
    } catch (e) {
      console.error('Claim apply error:', e);
      // Fallback: next player
      const nextPlayer = nextPlayerIndex(state.lastDiscardBy!);
      this.startPlayerTurn(room, nextPlayer);
    }
  }

  // ---- Self-Draw Win ----

  playerSelfDrawWin(room: ServerRoom, seatIndex: number): void {
    const state = room.gameState!;
    if (state.activePlayerIndex !== seatIndex) return;

    const player = state.players[seatIndex];
    // Pick last drawn tile as win tile
    const winTile = player.hand[player.hand.length - 1];
    const winResult = checkWin(player.hand.slice(0, -1), player.melds, winTile, true);

    if (!winResult) return; // invalid

    const fanBreakdown = calculateFan({
      isSelfDraw: true,
      isDealer: player.isDealer,
      revealedMelds: player.melds,
      flowerCount: player.flowerTiles.length,
      roundWind: state.round_wind,
      seatWind: seatIndex + 1,
      winResult,
    });

    const { state: newState, scoreDeltas } = applyWin(state, seatIndex, fanBreakdown, true);
    room.gameState = newState;

    this.io.to(room.id).emit(S2C_ROUND_END, {
      winnerId: player.id,
      winnerSeatIndex: seatIndex,
      isSelfDraw: true,
      fanBreakdown,
      scoreDeltas,
      hands: room.gameState.players.map(p => p.hand),
      reason: 'win',
    });

    setTimeout(() => this.startNextRound(room), 5000);
  }

  // ---- Round Exhausted ----

  endRoundExhausted(room: ServerRoom): void {
    this.io.to(room.id).emit(S2C_ROUND_END, {
      winnerId: null,
      winnerSeatIndex: null,
      isSelfDraw: false,
      fanBreakdown: null,
      scoreDeltas: [0, 0, 0, 0],
      hands: room.gameState!.players.map(p => p.hand),
      reason: 'exhausted',
    });
    setTimeout(() => this.startNextRound(room), 4000);
  }

  // ---- AI Scheduling ----

  private scheduleAITurn(room: ServerRoom, seatIndex: number): void {
    const delay = room.settings.aiSpeed + Math.floor(Math.random() * 400);
    const timer = setTimeout(() => {
      this.executeAITurn(room, seatIndex);
    }, delay);
    this.aiTimers.set(`${room.id}_ai_${seatIndex}`, timer);
  }

  private executeAITurn(room: ServerRoom, seatIndex: number): void {
    const state = room.gameState;
    if (!state || state.phase !== 'player_turn' || state.activePlayerIndex !== seatIndex) return;

    const player = state.players[seatIndex];

    // Check for self-draw win first
    const lastTile = player.hand[player.hand.length - 1];
    if (lastTile) {
      const winCheck = checkWin(player.hand.slice(0, -1), player.melds, lastTile, true);
      if (winCheck) {
        this.playerSelfDrawWin(room, seatIndex);
        return;
      }
    }

    // Check for concealed kong
    const kongTile = decideConcealedKong(state, seatIndex);
    if (kongTile !== null) {
      this.playerKong(room, seatIndex, kongTile, true);
      return;
    }

    // Discard
    const tileId = decideDiscard(state, seatIndex);
    this.playerDiscard(room, seatIndex, tileId);
  }

  private processAIClaim(room: ServerRoom, seatIndex: number, canChi: boolean): void {
    const state = room.gameState;
    if (!state || state.phase !== 'claim_window') return;

    const { action, chiTiles } = decideClaim(state, seatIndex, canChi);

    if (action !== 'pass') {
      this.submitClaim(room, seatIndex, action, chiTiles);
    }
    // pass = do nothing, let the timer resolve
  }

  // ---- Helpers ----

  private resolveInitialFlowers(room: ServerRoom): void {
    for (const player of room.players) {
      const flowers = room.gameState!.players[player.seatIndex].hand.filter(t => t.suit === 'Flower');
      for (const flower of flowers) {
        const newState = collectFlower(room.gameState!, player.seatIndex, flower.id);
        room.gameState = newState;

        if (room.gameState.deadWall.length > 0) {
          const { state, drawnTile } = drawFromDeadWall(room.gameState, player.seatIndex);
          room.gameState = state;
        }
      }
    }
    this.sendPrivateHands(room);
  }

  private broadcastState(room: ServerRoom): void {
    this.io.to(room.id).emit(S2C_GAME_STATE, toPublicState(room.gameState!));
  }

  private sendPrivateHands(room: ServerRoom): void {
    for (const player of room.players) {
      if (!player.isAI) {
        this.sendPrivateHand(room, player.seatIndex);
      }
    }
  }

  private sendPrivateHand(room: ServerRoom, seatIndex: number): void {
    const player = room.players[seatIndex];
    if (player.isAI) return;
    const hand = room.gameState!.players[seatIndex].hand;
    this.io.to(player.id).emit(S2C_HAND_UPDATE, { hand });
  }

  private clearClaimTimer(roomId: string): void {
    const timer = this.claimTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.claimTimers.delete(roomId);
    }
  }

  private clearAITimers(roomId: string): void {
    for (const [key, timer] of this.aiTimers) {
      if (key.startsWith(roomId)) {
        clearTimeout(timer);
        this.aiTimers.delete(key);
      }
    }
  }
}
