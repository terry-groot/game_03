import { create } from 'zustand';
import { Room } from '@mahjong/shared';

interface RoomStore {
  rooms: Room[];
  currentRoom: Room | null;
  mySeatIndex: number;
  myPlayerId: string;
  myPlayerName: string;

  setRooms: (rooms: Room[]) => void;
  setCurrentRoom: (room: Room | null, seatIndex?: number) => void;
  setMyPlayerId: (id: string) => void;
  setMyPlayerName: (name: string) => void;
  updateCurrentRoom: (room: Room) => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  rooms: [],
  currentRoom: null,
  mySeatIndex: 0,
  myPlayerId: '',
  myPlayerName: localStorage.getItem('mahjong_name') ?? '',

  setRooms: (rooms) => set({ rooms }),
  setCurrentRoom: (room, seatIndex = 0) => set({ currentRoom: room, mySeatIndex: seatIndex }),
  setMyPlayerId: (id) => set({ myPlayerId: id }),
  setMyPlayerName: (name) => {
    localStorage.setItem('mahjong_name', name);
    set({ myPlayerName: name });
  },
  updateCurrentRoom: (room) => set({ currentRoom: room }),
}));
