import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';
import { useUIStore } from '../../store/uiStore';

export const ScoreBoard: React.FC = () => {
  const { gameState } = useGameStore();
  const { mySeatIndex } = useRoomStore();
  const { showScoreBoard, setShowScoreBoard } = useUIStore();

  if (!showScoreBoard || !gameState) return null;

  const WIND_CHARS = ['東', '南', '西', '北'];

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-40"
      onClick={() => setShowScoreBoard(false)}
    >
      <div
        className="bg-gray-900 border border-gray-600 rounded-2xl p-5 w-64 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-white font-bold text-center mb-1">
          第{gameState.round}局 — {WIND_CHARS[(gameState.round - 1) % 4]}風
        </h2>
        <div className="text-gray-400 text-xs text-center mb-3">
          牌山剩餘: {gameState.wallTileCount}張
        </div>
        <div className="flex flex-col gap-2">
          {gameState.players.map((player, i) => (
            <div
              key={i}
              className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                i === mySeatIndex ? 'bg-green-900/50 border border-green-600' : 'bg-gray-800'
              }`}
            >
              <div>
                <span className="text-white font-medium">{player.name}</span>
                {player.isDealer && <span className="ml-1 text-yellow-400 text-xs">莊</span>}
                {i === mySeatIndex && <span className="ml-1 text-green-400 text-xs">我</span>}
                {player.isAI && <span className="ml-1 text-gray-400 text-xs">🤖</span>}
              </div>
              <div className="text-yellow-400 font-bold">{player.score}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowScoreBoard(false)}
          className="mt-4 w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
        >
          關閉
        </button>
      </div>
    </div>
  );
};
