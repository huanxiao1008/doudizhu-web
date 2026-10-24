import React, { useState, useEffect } from 'react';
import { socket } from './socket';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import GameTable from './components/GameTable';

export default function App() {
  const [roomState, setRoomState] = useState(null);
  const [mySeat, setMySeat] = useState(null);
  const [connected, setConnected] = useState(socket.connected);

  useEffect(() => {
    function handleState(state) {
      setRoomState(state);
    }
    function handleConnect() { setConnected(true); }
    function handleDisconnect() { setConnected(false); }
    socket.on('room:state', handleState);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    return () => {
      socket.off('room:state', handleState);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  function handleEnterRoom(roomId, seat) {
    setMySeat(seat);
  }

  let content;
  if (!roomState) {
    content = <Lobby onEnterRoom={handleEnterRoom} />;
  } else if (roomState.phase === 'WAITING') {
    content = <WaitingRoom roomState={roomState} mySeat={mySeat} />;
  } else {
    content = <GameTable roomState={roomState} mySeat={mySeat} />;
  }

  return (
    <>
      <div className="rotate-hint">
        <div className="icon">🔄</div>
        <div>請將平板横放以獲得最佳遊戲體驗</div>
      </div>
      <div className="app-content" style={{ width: '100%', height: '100%' }}>
        {!connected && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#a33', color: '#fff', textAlign: 'center', padding: 6, zIndex: 999 }}>
            連線中斷，正在重新連線...
          </div>
        )}
        {content}
      </div>
    </>
  );
}
