import React from 'react';
import { socket } from '../socket';

export default function WaitingRoom({ roomState, mySeat }) {
  const isFull = roomState.seats.every((s) => s !== null);

  function handleFillAI() {
    socket.emit('room:fillAI', {});
  }

  function handleStart() {
    socket.emit('game:start', {}, (res) => {
      if (!res.ok) alert(res.error);
    });
  }

  return (
    <div className="waiting-room">
      <h2>等待玩家加入</h2>
      <div className="room-code">房間號碼：{roomState.roomId}</div>
      <div className="seats-row">
        {roomState.seats.map((seat, i) => (
          <div key={i} className={`seat-box ${seat ? 'filled' : ''}`}>
            <div className="seat-avatar">{seat ? (seat.isAI ? '🤖' : '🧑') : '?'}</div>
            <div>{seat ? seat.name : '空位'}</div>
            {i === mySeat && <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>（你）</div>}
          </div>
        ))}
      </div>
      {!isFull && (
        <button className="lobby-btn secondary" onClick={handleFillAI}>
          不足三人？用電腦補位
        </button>
      )}
      {isFull && (
        <button className="lobby-btn" onClick={handleStart}>
          開始遊戲
        </button>
      )}
    </div>
  );
}
