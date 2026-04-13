import React, { useState, useEffect } from 'react';
import { socket } from '../../socket';
import {
  C2S_CREATE_ROOM, C2S_JOIN_ROOM, C2S_REQUEST_ROOMS, DEFAULT_SETTINGS,
} from '@mahjong/shared';
import { useRoomStore } from '../../store/roomStore';
import { useUIStore } from '../../store/uiStore';

export const LobbyPage: React.FC = () => {
  const { rooms, myPlayerName, setMyPlayerName } = useRoomStore();
  const [showCreate, setShowCreate] = useState(false);
  const [nameInput, setNameInput] = useState(myPlayerName);

  useEffect(() => {
    socket.emit(C2S_REQUEST_ROOMS);
    const interval = setInterval(() => socket.emit(C2S_REQUEST_ROOMS), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleNameSave = () => {
    const trimmed = nameInput.trim();
    if (trimmed) setMyPlayerName(trimmed);
  };

  const handleJoin = (roomId: string) => {
    const name = myPlayerName || nameInput.trim() || `玩家${Math.floor(Math.random() * 999)}`;
    setMyPlayerName(name);
    socket.emit(C2S_JOIN_ROOM, { roomId, playerName: name });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-black/40 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">🀄 台灣麻將</h1>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={e => e.key === 'Enter' && handleNameSave()}
            placeholder="輸入名字"
            maxLength={12}
            className="text-sm bg-black/30 text-white placeholder-gray-400 border border-gray-600 rounded-lg px-3 py-1.5 w-28 focus:outline-none focus:border-green-400"
          />
        </div>
      </div>

      {/* Scrollable room list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <div className="text-4xl mb-2">🀄</div>
            <p>目前沒有房間，建立一個吧！</p>
          </div>
        ) : (
          rooms.map(room => (
            <div
              key={room.id}
              className="bg-black/30 border border-gray-700 rounded-xl p-3 flex items-center justify-between"
            >
              <div>
                <div className="text-white font-medium">{room.name}</div>
                <div className="text-gray-400 text-xs mt-0.5">
                  {room.playerCount}/4 玩家 · {room.aiCount} 電腦
                  {room.isStarted && ' · 進行中'}
                </div>
              </div>
              <button
                disabled={room.isStarted || room.playerCount >= 4}
                onClick={() => handleJoin(room.id)}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg text-sm"
              >
                {room.isStarted ? '進行中' : room.playerCount >= 4 ? '已滿' : '加入'}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create room button */}
      <div className="p-3 bg-black/20">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl text-lg shadow-lg"
        >
          + 建立房間
        </button>
      </div>

      {/* Create room modal */}
      {showCreate && (
        <CreateRoomModal
          playerName={myPlayerName || nameInput.trim()}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
};

// ---- Create Room Modal ----
interface CreateRoomModalProps {
  playerName: string;
  onClose: () => void;
}

const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ playerName, onClose }) => {
  const [roomName, setRoomName] = useState(`${playerName || '玩家'}的房間`);
  const [includeFlowers, setIncludeFlowers] = useState(true);
  const [aiCount, setAiCount] = useState(3);
  const { setMyPlayerName } = useRoomStore();

  const handleCreate = () => {
    const name = playerName.trim() || `玩家${Math.floor(Math.random() * 999)}`;
    setMyPlayerName(name);
    socket.emit(C2S_CREATE_ROOM, {
      playerName: name,
      roomName: roomName.trim() || `${name}的房間`,
      settings: {
        ...DEFAULT_SETTINGS,
        includeFlowers,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50">
      <div className="bg-gray-900 rounded-t-2xl p-5 w-full max-w-md">
        <h2 className="text-white font-bold text-lg mb-4">建立新房間</h2>

        <div className="space-y-3">
          <div>
            <label className="text-gray-400 text-sm mb-1 block">房間名稱</label>
            <input
              type="text"
              value={roomName}
              onChange={e => setRoomName(e.target.value)}
              maxLength={30}
              className="w-full bg-black/40 text-white border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-green-400"
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="text-gray-300">花牌</span>
            <button
              onClick={() => setIncludeFlowers(!includeFlowers)}
              className={`w-12 h-6 rounded-full transition-colors ${includeFlowers ? 'bg-green-500' : 'bg-gray-600'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform mx-0.5 ${includeFlowers ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl"
          >
            建立
          </button>
        </div>
      </div>
    </div>
  );
};
