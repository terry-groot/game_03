import React, { useRef } from 'react';
import { Tile } from '@mahjong/shared';
import { TileComponent } from './TileComponent';
import { MeldGroup } from './MeldGroup';
import { useGameStore } from '../../store/gameStore';
import { useRoomStore } from '../../store/roomStore';
import { useGame } from '../../hooks/useGame';

interface MyHandProps {
  tileSize?: number;
}

export const MyHand: React.FC<MyHandProps> = ({ tileSize = 44 }) => {
  const { myHand, selectedTileId, lastDrawnTileId, gameState } = useGameStore();
  const { mySeatIndex } = useRoomStore();
  const { isMyTurn, handleTileClick } = useGame();

  const myPlayer = gameState?.players[mySeatIndex];

  return (
    <div className="flex flex-col items-center gap-1 w-full">
      {/* Revealed melds */}
      {myPlayer && myPlayer.melds.length > 0 && (
        <div className="flex gap-2 justify-center flex-wrap">
          {myPlayer.melds.map((meld, i) => (
            <MeldGroup key={i} meld={meld} tileSize={tileSize - 6} />
          ))}
        </div>
      )}

      {/* Concealed hand */}
      <div
        className="flex gap-1 overflow-x-auto scrollbar-hide px-2 py-1 max-w-full"
        style={{ touchAction: 'pan-x' }}
      >
        {myHand.map((tile) => (
          <TileComponent
            key={tile.id}
            tile={tile}
            size={tileSize}
            selected={selectedTileId === tile.id}
            isNew={lastDrawnTileId === tile.id}
            onClick={isMyTurn ? () => handleTileClick(tile.id) : undefined}
          />
        ))}
      </div>

      {isMyTurn && selectedTileId && (
        <div className="text-xs text-yellow-200 animate-pulse">
          再次點擊打出 / 點選其他牌
        </div>
      )}
      {isMyTurn && !selectedTileId && (
        <div className="text-xs text-green-200">
          輪到你了，請打出一張牌
        </div>
      )}
    </div>
  );
};
