import React, { useState } from 'react';
import { socket } from '../socket';

export default function Lobby({ onEnterRoom }) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleCreate() {
    if (!name.trim()) { setError('請先輸入你的名字'); return; }
    setLoading(true);
    setError('');
    socket.emit('room:create', { name: name.trim() }, (res) => {
      setLoading(false);
      if (res.ok) {
        onEnterRoom(res.roomId, res.seat);
      } else {
        setError(res.error || '建立房間失敗');
      }
    });
  }

  function handleJoin() {
    if (!name.trim()) { setError('請先輸入你的名字'); return; }
    if (!joinCode.trim()) { setError('請輸入房間號碼'); return; }
    setLoading(true);
    setError('');
    socket.emit('room:join', { roomId: joinCode.trim(), name: name.trim() }, (res) => {
      setLoading(false);
      if (res.ok) {
        onEnterRoom(res.roomId, res.seat);
      } else {
        setError(res.error || '加入房間失敗');
      }
    });
  }

  return (
    <div className="lobby">
      <h1>鬥 地 主</h1>
      <div className="lobby-card">
        <input
          placeholder="輸入你的名字"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={10}
        />
        <button className="lobby-btn" onClick={handleCreate} disabled={loading}>
          建立新房間
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="輸入房間號碼"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
            maxLength={6}
            style={{ flex: 1 }}
          />
          <button className="lobby-btn secondary" onClick={handleJoin} disabled={loading}>
            加入
          </button>
        </div>
        {error && <div className="lobby-error">{error}</div>}
      </div>
    </div>
  );
}
