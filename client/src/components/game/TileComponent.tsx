import React from 'react';
import { Tile } from '@mahjong/shared';

interface TileProps {
  tile: Tile;
  size?: number;          // px width
  selected?: boolean;
  faceDown?: boolean;
  isNew?: boolean;        // animate in
  onClick?: () => void;
  className?: string;
}

function getTileColorClass(tile: Tile): string {
  if (tile.suit === 'Man') return 'tile-man';
  if (tile.suit === 'Pin') return 'tile-pin';
  if (tile.suit === 'Sou') return 'tile-sou';
  if (tile.suit === 'Flower') return 'tile-flower';
  if (tile.suit === 'Dragon') {
    if (tile.value === 1) return 'tile-chun';
    if (tile.value === 2) return 'tile-hatsu';
    return 'tile-haku';
  }
  return 'tile-wind';
}

function getSuitSymbol(tile: Tile): string {
  if (tile.suit === 'Man') return '萬';
  if (tile.suit === 'Pin') return '●';
  if (tile.suit === 'Sou') return '竹';
  return tile.display;
}

const NUM_KANJI = ['一','二','三','四','五','六','七','八','九'];

export const TileComponent: React.FC<TileProps> = ({
  tile, size = 44, selected, faceDown, isNew, onClick, className = ''
}) => {
  const width = size;
  const fontSize = size * 0.28;

  if (faceDown) {
    return (
      <div
        className={`tile face-down ${className}`}
        style={{ width, fontSize }}
        aria-label="face-down tile"
      />
    );
  }

  const colorClass = getTileColorClass(tile);
  const isHonorOrFlower = tile.suit === 'Wind' || tile.suit === 'Dragon' || tile.suit === 'Flower';

  return (
    <div
      className={`tile ${colorClass} ${selected ? 'selected' : ''} ${isNew ? 'tile-new' : ''} ${className}`}
      style={{ width, fontSize }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={tile.display}
      aria-pressed={selected}
    >
      {isHonorOrFlower ? (
        // Honor/flower: large character centered
        <span style={{ fontSize: '1.8em', lineHeight: 1, margin: 'auto', fontWeight: 'bold' }}>
          {tile.display}
        </span>
      ) : (
        <>
          <span className="tile-value">{tile.value}</span>
          <span className="tile-suit">{getSuitSymbol(tile)}</span>
          <span className="tile-value" style={{ alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>
            {tile.value}
          </span>
        </>
      )}
    </div>
  );
};
