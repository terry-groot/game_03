import React from 'react';
import { useSocket } from './hooks/useSocket';
import { useUIStore } from './store/uiStore';
import { LobbyPage } from './components/lobby/LobbyPage';
import { GamePage } from './components/game/GamePage';

function App() {
  useSocket();

  const { view, errorMessage } = useUIStore();

  return (
    <div className="h-full flex flex-col">
      {view === 'lobby' ? <LobbyPage /> : <GamePage />}

      {/* Global error toast */}
      {errorMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm max-w-xs text-center">
          {errorMessage}
        </div>
      )}
    </div>
  );
}

export default App;
