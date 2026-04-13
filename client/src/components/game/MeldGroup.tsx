import React from 'react';
import { Meld } from '@mahjong/shared';
import { TileComponent } from './TileComponent';

interface MeldGroupProps {
  meld: Meld;
  tileSize?: number;
}

export const MeldGroup: React.FC<MeldGroupProps> = ({ meld, tileSize = 36 }) => {
  const isConcealed = meld.type === 'concealed_kong';

  return (
    <div className="flex gap-0.5 items-end">
      {meld.tiles.map((tile, i) => (
        <TileComponent
          key={tile.id}
          tile={tile}
          size={tileSize}
          faceDown={isConcealed && (i === 0 || i === 3)}
        />
      ))}
    </div>
  );
};
