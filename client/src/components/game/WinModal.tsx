import React from 'react';
import { S2C_RoundEndPayload } from '@mahjong/shared';
import { useRoomStore } from '../../store/roomStore';
import { useUIStore } from '../../store/uiStore';

interface WinModalProps {
  data: S2C_RoundEndPayload;
}

export const WinModal: React.FC<WinModalProps> = ({ data }) => {
  const { mySeatIndex, currentRoom } = useRoomStore();
  const { setRoundEndData } = useUIStore();

  const isWinner = data.winnerSeatIndex === mySeatIndex;
  const isExhausted = data.reason === 'exhausted';

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-gray-900 border-2 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl ${
          isExhausted ? 'border-gray-500' : isWinner ? 'border-yellow-400 win-pulse' : 'border-red-500'
        }`}
      >
        {isExhausted ? (
          <>
            <div className="text-4xl mb-2">😔</div>
            <h2 className="text-2xl font-bold text-gray-300 mb-2">荒牌</h2>
            <p className="text-gray-400">牌山用完，本局流局</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-2">{isWinner ? '🏆' : '😭'}</div>
            <h2 className={`text-2xl font-bold mb-2 ${isWinner ? 'text-yellow-400' : 'text-red-400'}`}>
              {isWinner ? '恭喜胡牌！' : '對家胡牌了'}
            </h2>
            {data.isSelfDraw && (
              <div className="text-green-400 font-bold mb-2">自摸！</div>
            )}
          </>
        )}

        {/* Fan breakdown */}
        {data.fanBreakdown && (
          <div className="mt-3 bg-black/30 rounded-lg p-3 text-left">
            <div className="text-gray-400 text-xs mb-1">番型：</div>
            {data.fanBreakdown.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-300">{item.nameZh}</span>
                <span className="text-yellow-300">{item.fan}番</span>
              </div>
            ))}
            <div className="border-t border-gray-600 mt-2 pt-2 flex justify-between font-bold">
              <span className="text-white">合計</span>
              <span className="text-yellow-400">{data.fanBreakdown.totalFan}番</span>
            </div>
          </div>
        )}

        {/* Score deltas */}
        <div className="mt-3 grid grid-cols-4 gap-1">
          {data.scoreDeltas.map((delta, i) => (
            <div key={i} className="text-center">
              <div className="text-xs text-gray-400">
                {i === mySeatIndex ? '我' : `P${i + 1}`}
              </div>
              <div className={`text-sm font-bold ${delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {delta > 0 ? '+' : ''}{delta}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-gray-500 text-xs">下局即將開始...</div>
      </div>
    </div>
  );
};
