import React from 'react';
import { PlayerPublic } from '@mahjong/shared';
import { TileComponent } from './TileComponent';
import { MeldGroup } from './MeldGroup';

interface OpponentHandProps {
  player: PlayerPublic;
  position: 'top' | 'left' | 'right';
  isActive?: boolean;
  tileSize?: number;
}

// Dummy tile for face-down rendering
const DUMMY_TILE = {
  id: -1, typeIndex: 0, suit: 'Man' as const,
  value: 1, display: '', copyIndex: 0,
};

export const OpponentHand: React.FC<OpponentHandProps> = ({
  player, position, isActive, tileSize = 32,
}) => {
  const isVertical = position === 'left' || position === 'right';
  const rotateDeg = position === 'top' ? 180 : position === 'left' ? 90 : -90;

  return (
    <div
      className={`flex flex-col items-center gap-1 ${isActive ? 'opacity-100' : 'opacity-80'}`}
      style={{ transform: `rotate(${rotateDeg}deg)` }}
    >
      {/* Player name + score */}
      <div
        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          isActive ? 'bg-yellow-400 text-black' : 'bg-black/40 text-white'
        }`}
        style={{ transform: `rotate(${-rotateDeg}deg)` }}
      >
        {player.isDealer ? '莊 ' : ''}{player.name}
        {player.isAI && ' 🤖'}
      </div>

      {/* Revealed melds */}
      {player.melds.length > 0 && (
        <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} gap-0.5`}>
          {player.melds.map((meld, i) => (
            <MeldGroup key={i} meld={meld} tileSize={tileSize - 4} />
          ))}
        </div>
      )}

      {/* Face-down tiles (show count on mobile) */}
      <div className={`flex ${isVertical ? 'flex-col' : 'flex-row'} gap-0.5`}>
        {/* On small screens, show tile count badge instead of individual tiles */}
        <div className="hidden xs:flex gap-0.5 flex-wrap max-w-32 max-h-32 overflow-hidden">
          {Array.from({ length: Math.min(player.handCount, 16) }).map((_, i) => (
            <TileComponent
              key={i}
              tile={DUMMY_TILE}
              size={tileSize}
              faceDown
            />
          ))}
        </div>
        <div className="flex xs:hidden items-center justify-center bg-black/30 rounded-lg px-3 py-2">
          <span className="text-white font-bold text-sm">{player.handCount}張</span>
        </div>
      </div>

      {/* Flower count */}
      {player.flowerTiles.length > 0 && (
        <div className="text-xs text-yellow-300" style={{ transform: `rotate(${-rotateDeg}deg)` }}>
          🌸×{player.flowerTiles.length}
        </div>
      )}
    </div>
  );
};
