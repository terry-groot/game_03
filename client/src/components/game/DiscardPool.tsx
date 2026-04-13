import React from 'react';
import { Tile } from '@mahjong/shared';
import { TileComponent } from './TileComponent';
import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';

// The discard pool shows 4 quadrants (one per player)
// Positioned relative to the viewer's seat

export const DiscardPool: React.FC = () => {
  const { gameState } = useGameStore();
  const { mySeatIndex } = useRoomStore();

  if (!gameState) return null;

  // Map seat indices to visual positions relative to mySeatIndex
  // bottom = me, right = right opponent, top = opposite, left = left opponent
  const getRelativeSeat = (seatIndex: number) => {
    const diff = (seatIndex - mySeatIndex + 4) % 4;
    return ['bottom', 'right', 'top', 'left'][diff] as 'bottom' | 'right' | 'top' | 'left';
  };

  const positionToPlayer: Record<string, typeof gameState.players[0]> = {};
  for (const player of gameState.players) {
    const pos = getRelativeSeat(player.seatIndex);
    positionToPlayer[pos] = player;
  }

  const DiscardPile = ({
    player,
    position,
  }: {
    player: typeof gameState.players[0];
    position: 'bottom' | 'right' | 'top' | 'left';
  }) => {
    const rotations = { bottom: 0, right: -90, top: 180, left: 90 };
    const rotateDeg = rotations[position];
    const isLastDiscard = (t: Tile) =>
      gameState.lastDiscardBy === player.seatIndex &&
      gameState.lastDiscard?.id === t.id &&
      player.discards[player.discards.length - 1]?.id === t.id;

    return (
      <div
        className="flex flex-wrap gap-0.5 items-start content-start p-1"
        style={{
          transform: `rotate(${rotateDeg}deg)`,
          width: '100%',
          height: '100%',
          maxWidth: 120,
          maxHeight: 120,
        }}
      >
        {player.discards.map((tile, i) => (
          <TileComponent
            key={tile.id}
            tile={tile}
            size={22}
            className={isLastDiscard(tile) ? 'ring-2 ring-yellow-400' : ''}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* 4-quadrant grid */}
      <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full max-w-64 max-h-64">
        {/* Top-left = top player's discards */}
        <div className="flex items-end justify-end">
          {positionToPlayer.top && (
            <DiscardPile player={positionToPlayer.top} position="top" />
          )}
        </div>
        {/* Top-right = right player's discards */}
        <div className="flex items-end justify-start">
          {positionToPlayer.right && (
            <DiscardPile player={positionToPlayer.right} position="right" />
          )}
        </div>
        {/* Bottom-left = left player's discards */}
        <div className="flex items-start justify-end">
          {positionToPlayer.left && (
            <DiscardPile player={positionToPlayer.left} position="left" />
          )}
        </div>
        {/* Bottom-right = my discards */}
        <div className="flex items-start justify-start">
          {positionToPlayer.bottom && (
            <DiscardPile player={positionToPlayer.bottom} position="bottom" />
          )}
        </div>
      </div>

      {/* Wall count indicator */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="bg-black/50 rounded-lg px-2 py-1 text-xs text-center">
          <div className="text-gray-300">牌山</div>
          <div className="text-white font-bold">{gameState.wallTileCount}</div>
        </div>
      </div>
    </div>
  );
};
