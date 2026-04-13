import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useUIStore } from '../../store/uiStore';
import { useGame } from '../../hooks/useGame';
import { useRoomStore } from '../../store/roomStore';

export const ActionBar: React.FC = () => {
  const { claimOptions, chiOptions, claimTimeoutPct, gameState } = {
    ...useGameStore(),
    claimTimeoutPct: useUIStore().claimTimeoutPct,
  };
  const { claim, isMyTurn, declareSelfDrawWin } = useGame();
  const { mySeatIndex } = useRoomStore();
  const [chiPickerOpen, setChiPickerOpen] = useState(false);

  const isClaimWindow = gameState?.phase === 'claim_window';
  const showClaimButtons = isClaimWindow && claimOptions.length > 0;

  // Self-draw win button (胡)
  const canSelfDraw = isMyTurn && gameState?.phase === 'player_turn';
  // (checkWin runs on server, but we can show the button if tenpai)

  if (!showClaimButtons && !isClaimWindow) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pb-safe">
      {/* Countdown bar */}
      {isClaimWindow && (
        <div className="h-1.5 bg-gray-700 w-full">
          <div
            className="h-full bg-yellow-400 transition-none"
            style={{ width: `${claimTimeoutPct}%` }}
          />
        </div>
      )}

      <div className="bg-black/80 backdrop-blur px-3 py-2 flex gap-2 justify-center items-center flex-wrap">
        {showClaimButtons && (
          <>
            {claimOptions.includes('hu') && (
              <button
                onClick={() => claim('hu')}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-sm shadow-lg"
              >
                🏆 胡牌
              </button>
            )}
            {claimOptions.includes('kong') && (
              <button
                onClick={() => claim('kong')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-sm shadow-lg"
              >
                槓
              </button>
            )}
            {claimOptions.includes('pong') && (
              <button
                onClick={() => claim('pong')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm shadow-lg"
              >
                碰
              </button>
            )}
            {claimOptions.includes('chi') && (
              <button
                onClick={() => {
                  if (chiOptions.length === 1) {
                    claim('chi', chiOptions[0]);
                  } else {
                    setChiPickerOpen(true);
                  }
                }}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm shadow-lg"
              >
                吃
              </button>
            )}
            <button
              onClick={() => claim('pass')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm shadow-lg"
            >
              過
            </button>
          </>
        )}

        {isClaimWindow && claimOptions.length === 0 && (
          <span className="text-gray-400 text-sm">等待其他玩家...</span>
        )}
      </div>

      {/* Chi picker overlay */}
      {chiPickerOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 pb-16">
          <div className="bg-gray-800 rounded-t-2xl p-4 w-full max-w-sm">
            <h3 className="text-white font-bold mb-3 text-center">選擇吃牌方式</h3>
            <div className="flex flex-col gap-2">
              {chiOptions.map(([a, b], i) => (
                <button
                  key={i}
                  onClick={() => {
                    claim('chi', [a, b]);
                    setChiPickerOpen(false);
                  }}
                  className="py-2 px-4 bg-green-600 hover:bg-green-500 text-white rounded-lg"
                >
                  選擇組合 {i + 1}
                </button>
              ))}
              <button
                onClick={() => setChiPickerOpen(false)}
                className="py-2 px-4 bg-gray-600 text-white rounded-lg"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
