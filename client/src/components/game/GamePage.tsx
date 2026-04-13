import React, { useEffect } from 'react';
import { socket } from '../../socket';
import { C2S_READY } from '@mahjong/shared';
import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';
import { useUIStore } from '../../store/uiStore';
import { OpponentHand } from './OpponentHand';
import { MyHand } from './MyHand';
import { DiscardPool } from './DiscardPool';
import { ActionBar } from './ActionBar';
import { WinModal } from './WinModal';
import { ScoreBoard } from './ScoreBoard';

export const GamePage: React.FC = () => {
  const { gameState, myHand } = useGameStore();
  const { mySeatIndex, currentRoom } = useRoomStore();
  const { roundEndData, setRoundEndData, gameOverData, setGameOverData, setShowScoreBoard } = useUIStore();

  // Map seat indices to visual positions (relative to mySeatIndex)
  const getRelativeSeat = (seatIndex: number) => {
    const diff = (seatIndex - mySeatIndex + 4) % 4;
    return ['bottom', 'right', 'top', 'left'][diff] as 'bottom' | 'right' | 'top' | 'left';
  };

  const players = gameState?.players ?? [];
  const topPlayer = players.find(p => getRelativeSeat(p.seatIndex) === 'top');
  const leftPlayer = players.find(p => getRelativeSeat(p.seatIndex) === 'left');
  const rightPlayer = players.find(p => getRelativeSeat(p.seatIndex) === 'right');

  const isActive = (seatIndex: number) => gameState?.activePlayerIndex === seatIndex;

  // Waiting room state
  const gameStarted = !!gameState && gameState.phase !== 'waiting';

  return (
    <div className="flex flex-col h-full bg-green-900 relative overflow-hidden">
      {/* Top bar */}
      <div className="flex justify-between items-center px-3 py-1.5 bg-black/30 z-10">
        <div className="text-sm font-bold text-white">
          🀄 {currentRoom?.name ?? '麻將'}
        </div>
        <div className="flex gap-2 items-center">
          {gameState && (
            <span className="text-xs text-gray-300">
              第{gameState.round}局 · {gameState.wallTileCount}張
            </span>
          )}
          <button
            onClick={() => setShowScoreBoard(true)}
            className="text-xs bg-black/40 px-2 py-1 rounded text-gray-200 hover:bg-black/60"
          >
            積分
          </button>
        </div>
      </div>

      {!gameStarted ? (
        /* Waiting Room */
        <WaitingRoom />
      ) : (
        /* Main game layout: CSS Grid 3x3 */
        <div
          className="flex-1 grid gap-1 p-1 pb-14"
          style={{
            gridTemplateColumns: 'minmax(50px, 100px) 1fr minmax(50px, 100px)',
            gridTemplateRows: 'minmax(50px, 100px) 1fr minmax(80px, 120px)',
            minHeight: 0,
          }}
        >
          {/* Row 1: top-left corner, top opponent, top-right corner */}
          <div className="flex items-end justify-end" />

          <div className="flex items-start justify-center">
            {topPlayer && (
              <OpponentHand
                player={topPlayer}
                position="top"
                isActive={isActive(topPlayer.seatIndex)}
                tileSize={28}
              />
            )}
          </div>

          <div className="flex items-end justify-start" />

          {/* Row 2: left opponent, center (discard pool), right opponent */}
          <div className="flex items-center justify-end">
            {leftPlayer && (
              <OpponentHand
                player={leftPlayer}
                position="left"
                isActive={isActive(leftPlayer.seatIndex)}
                tileSize={24}
              />
            )}
          </div>

          <div className="flex items-center justify-center">
            <DiscardPool />
          </div>

          <div className="flex items-center justify-start">
            {rightPlayer && (
              <OpponentHand
                player={rightPlayer}
                position="right"
                isActive={isActive(rightPlayer.seatIndex)}
                tileSize={24}
              />
            )}
          </div>

          {/* Row 3: my hand area (spans full width) */}
          <div className="col-span-3 flex items-center justify-center">
            <MyHand tileSize={42} />
          </div>
        </div>
      )}

      {/* Action bar (claim buttons) */}
      <ActionBar />

      {/* Overlays */}
      <ScoreBoard />
      {roundEndData && (
        <WinModal data={roundEndData} />
      )}

      {gameOverData && (
        <GameOverOverlay data={gameOverData} />
      )}
    </div>
  );
};

// ---- Waiting Room Component ----
const WaitingRoom: React.FC = () => {
  const { currentRoom, mySeatIndex } = useRoomStore();

  const handleReady = () => {
    if (currentRoom) {
      socket.emit(C2S_READY, { roomId: currentRoom.id });
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
      <h2 className="text-2xl font-bold text-white">等待玩家就緒</h2>
      <div className="bg-black/30 rounded-xl p-4 w-full max-w-xs">
        <div className="text-gray-300 text-sm mb-3 text-center">房間: {currentRoom?.name}</div>
        <div className="text-gray-400 text-xs text-center mb-4">
          {currentRoom?.playerCount}/4 位玩家 (不足4人將補充電腦)
        </div>
        <div className="flex flex-col gap-2 mb-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1 px-3 bg-black/20 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${i < (currentRoom?.playerCount ?? 0) ? 'bg-green-400' : 'bg-gray-600'}`} />
              <span className="text-gray-300 text-sm">
                {i < (currentRoom?.playerCount ?? 0) ? `玩家 ${i + 1}` : '空位'}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={handleReady}
          className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-lg"
        >
          準備就緒
        </button>
      </div>
    </div>
  );
};

// ---- Game Over Overlay ----
const GameOverOverlay: React.FC<{ data: { finalScores: number[]; rankings: number[] } }> = ({ data }) => {
  const { mySeatIndex } = useRoomStore();
  const { setGameOverData, setView } = useUIStore();

  const myRank = data.rankings.indexOf(mySeatIndex) + 1;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border-2 border-yellow-400 rounded-2xl p-6 max-w-sm w-full text-center">
        <div className="text-5xl mb-3">
          {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '😔'}
        </div>
        <h2 className="text-2xl font-bold text-yellow-400 mb-4">遊戲結束</h2>
        <div className="flex flex-col gap-2 mb-5">
          {data.rankings.map((seatIndex, rank) => (
            <div
              key={seatIndex}
              className={`flex justify-between px-4 py-2 rounded-lg ${
                seatIndex === mySeatIndex ? 'bg-green-900/50 border border-green-500' : 'bg-gray-800'
              }`}
            >
              <span className="text-gray-300">#{rank + 1} 玩家 {seatIndex + 1}</span>
              <span className="text-yellow-400 font-bold">{data.finalScores[seatIndex]}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => {
            setGameOverData(null);
            setView('lobby');
          }}
          className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl"
        >
          返回大廳
        </button>
      </div>
    </div>
  );
};
