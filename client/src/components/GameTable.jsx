import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import Card from './Card';
import { sortHand } from '../cardUtils';

const QUICK_MESSAGES = ['快出牌', '好牌', '別搶了', '過啦', '要得起嗎', '加油', '哈哈哈', '可惜了'];
const ITEMS = [
  { type: 'tomato', emoji: '🍅' },
  { type: 'bucket', emoji: '🪣' },
  { type: 'egg', emoji: '🥚' },
];
const ITEM_COOLDOWN_MS = 15000;
const ITEM_MAX_USES = 5;

export default function GameTable({ roomState, mySeat, onRestart }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [bubbles, setBubbles] = useState([]); // {id, seat, text}
  const [flyingItems, setFlyingItems] = useState([]); // {id, itemType, fromSeat, targetSeat}
  const [splats, setSplats] = useState([]); // {id, seat, emoji}
  const [itemUses, setItemUses] = useState({ tomato: ITEM_MAX_USES, bucket: ITEM_MAX_USES, egg: ITEM_MAX_USES });
  const [itemCooldownUntil, setItemCooldownUntil] = useState(0);
  const avatarRefs = useRef({});

  useEffect(() => {
    function handleChat({ seat, text }) {
      const id = Math.random().toString(36).slice(2);
      setBubbles((prev) => [...prev, { id, seat, text }]);
      setTimeout(() => setBubbles((prev) => prev.filter((b) => b.id !== id)), 3000);
    }
    function handleThrown({ fromSeat, targetSeat, itemType }) {
      const id = Math.random().toString(36).slice(2);
      setFlyingItems((prev) => [...prev, { id, fromSeat, targetSeat, itemType }]);
      setTimeout(() => {
        setFlyingItems((prev) => prev.filter((f) => f.id !== id));
        const emoji = ITEMS.find((it) => it.type === itemType)?.emoji || '💥';
        const splatId = Math.random().toString(36).slice(2);
        setSplats((prev) => [...prev, { id: splatId, seat: targetSeat, emoji }]);
        setTimeout(() => setSplats((prev) => prev.filter((s) => s.id !== splatId)), 2500);
      }, 600);
    }
    socket.on('chat:message', handleChat);
    socket.on('interact:thrown', handleThrown);
    return () => {
      socket.off('chat:message', handleChat);
      socket.off('interact:thrown', handleThrown);
    };
  }, []);

  // 清除選牌：換到新的一輪或換人出牌時
  useEffect(() => {
    setSelectedIds(new Set());
  }, [roomState.turn, roomState.phase]);

  const myHand = sortHand(roomState.myHand || []);
  const isMyTurn = roomState.turn === mySeat;
  const isMyBid = roomState.currentBidder === mySeat;
  const relativeSeats = [0, 1, 2].map((offset) => (mySeat + offset) % 3);
  const [bottomSelfSeat, rightSeat, leftSeat] = relativeSeats; // bottomSelfSeat === mySeat

  function toggleCard(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handlePlay() {
    const cardIds = [...selectedIds];
    socket.emit('game:play', { cardIds }, (res) => {
      if (!res.ok) alert(res.error);
    });
  }

  function handlePass() {
    socket.emit('game:play', { cardIds: [] }, (res) => {
      if (!res.ok) alert(res.error);
    });
  }

  function handleBid(bid) {
    socket.emit('game:bid', { bid }, (res) => {
      if (!res.ok) alert(res.error);
    });
  }

  function sendQuickMessage(text) {
    socket.emit('chat:quick', { text });
    setShowQuickMenu(false);
  }

  function throwItem(itemType, targetSeat) {
    const now = Date.now();
    if (now < itemCooldownUntil) return;
    if (itemUses[itemType] <= 0) return;
    socket.emit('interact:throw', { itemType, targetSeat });
    setItemUses((prev) => ({ ...prev, [itemType]: prev[itemType] - 1 }));
    setItemCooldownUntil(now + ITEM_COOLDOWN_MS);
  }

  const seatLabel = (seat) => {
    const info = roomState.seats[seat];
    if (!info) return '';
    return info.name + (info.isLandlord ? '（地主）' : '');
  };

  return (
    <div className="table">
      {/* 對手資訊列 */}
      <div className="opponent-bar">
        <div className="opponent-info" ref={(el) => (avatarRefs.current[leftSeat] = el)}>
          <div className="avatar">{roomState.seats[leftSeat]?.isAI ? '🤖' : '🧑'}
            {roomState.seats[leftSeat]?.isLandlord && <span className="landlord-badge">地主</span>}
          </div>
          <div>
            <div>{seatLabel(leftSeat)}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>剩 {roomState.seats[leftSeat]?.cardCount ?? '-'} 張</div>
          </div>
        </div>
        <div className="opponent-info" ref={(el) => (avatarRefs.current[rightSeat] = el)}>
          <div className="avatar">{roomState.seats[rightSeat]?.isAI ? '🤖' : '🧑'}
            {roomState.seats[rightSeat]?.isLandlord && <span className="landlord-badge">地主</span>}
          </div>
          <div>
            <div>{seatLabel(rightSeat)}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>剩 {roomState.seats[rightSeat]?.cardCount ?? '-'} 張</div>
          </div>
        </div>
      </div>

      {/* 聊天泡泡 */}
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="chat-bubble"
          style={{ top: b.seat === mySeat ? '72%' : '14%', left: b.seat === leftSeat ? '12%' : b.seat === rightSeat ? '75%' : '45%' }}
        >
          {b.text}
        </div>
      ))}

      {/* 污濤貼紙 */}
      {splats.map((s) => (
        <div
          key={s.id}
          className="splat-sticker"
          style={{ top: s.seat === mySeat ? '68%' : '10%', left: s.seat === leftSeat ? '8%' : s.seat === rightSeat ? '80%' : '46%' }}
        >
          {s.emoji}
        </div>
      ))}

      {/* 飛行道具 */}
      {flyingItems.map((f) => (
        <div
          key={f.id}
          className="flying-item"
          style={{
            top: f.fromSeat === mySeat ? '70%' : '12%',
            left: f.fromSeat === leftSeat ? '10%' : f.fromSeat === rightSeat ? '78%' : '47%',
          }}
        >
          {ITEMS.find((it) => it.type === f.itemType)?.emoji}
        </div>
      ))}

      {/* 中央區域：底牌、出牌記錄、倍數 */}
      <div className="center-area">
        {roomState.phase === 'BIDDING' && (
          <div className="bottom-cards">
            {[0, 1, 2].map((i) => <Card key={i} card={{ rank: 0, suit: null, id: 'back' + i }} small />)}
          </div>
        )}
        {roomState.multiplier > 1 && (
          <div className="multiplier-tag">倍數 x{roomState.multiplier}</div>
        )}
        <div className="played-cards-area">
          {roomState.history.slice(-3).map((h, idx) => (
            <div className="played-group" key={idx}>
              <div className="label">{seatLabel(h.seat)}</div>
              <div className="cards-row">
                {h.cards.map((c) => <Card key={c.id} card={c} small />)}
              </div>
            </div>
          ))}
        </div>
        {roomState.phase === 'PLAYING' && (
          <div className="turn-indicator">
            {isMyTurn ? '輪到你出牌' : `等待 ${seatLabel(roomState.turn)} 出牌`}
          </div>
        )}
      </div>

      {/* 叫地主按鈕 */}
      {roomState.phase === 'BIDDING' && isMyBid && (
        <div className="controls-bar">
          <button className="ctrl-btn bid-yes" onClick={() => handleBid(true)}>我要地主</button>
          <button className="ctrl-btn bid-no" onClick={() => handleBid(false)}>不叫</button>
        </div>
      )}
      {roomState.phase === 'BIDDING' && !isMyBid && (
        <div className="controls-bar">
          <div className="turn-indicator" style={{ position: 'static' }}>等待 {seatLabel(roomState.currentBidder)} 決定是否叫地主</div>
        </div>
      )}

      {/* 我的手牌 */}
      <div className="hand-area">
        <div className="hand-cards">
          {myHand.map((c) => (
            <Card key={c.id} card={c} selected={selectedIds.has(c.id)} onClick={() => toggleCard(c.id)} />
          ))}
        </div>
      </div>

      {/* 出牌控制 */}
      {roomState.phase === 'PLAYING' && (
        <div className="controls-bar">
          <button className="ctrl-btn pass" disabled={!isMyTurn || roomState.lastPattern === null} onClick={handlePass}>
            過牌
          </button>
          <button className="ctrl-btn play" disabled={!isMyTurn || selectedIds.size === 0} onClick={handlePlay}>
            出牌
          </button>
        </div>
      )}

      {/* 快捷訊息與道具面板 */}
      <div className="quick-panel">
        {showQuickMenu && (
          <div className="quick-menu">
            {QUICK_MESSAGES.map((msg) => (
              <button key={msg} onClick={() => sendQuickMessage(msg)}>{msg}</button>
            ))}
          </div>
        )}
        <button className="quick-toggle-btn" onClick={() => setShowQuickMenu((v) => !v)}>💬</button>
        <div className="item-menu">
          {ITEMS.map((item) => (
            <button
              key={item.type}
              className="item-btn"
              onClick={() => throwItem(item.type, leftSeat)}
              disabled={itemUses[item.type] <= 0 || Date.now() < itemCooldownUntil}
              title={`丟給 ${seatLabel(leftSeat)}`}
            >
              {item.emoji}
              <span className="count">{itemUses[item.type]}</span>
            </button>
          ))}
        </div>
        <div className="item-menu">
          {ITEMS.map((item) => (
            <button
              key={item.type + '_r'}
              className="item-btn"
              onClick={() => throwItem(item.type, rightSeat)}
              disabled={itemUses[item.type] <= 0 || Date.now() < itemCooldownUntil}
              title={`丟給 ${seatLabel(rightSeat)}`}
            >
              {item.emoji}
            </button>
          ))}
        </div>
      </div>

      {/* 結算畫面 */}
      {roomState.phase === 'FINISHED' && (
        <div className="result-overlay">
          <div className="result-card">
            <h2>{roomState.winningTeam === 'landlord' ? '地主勝利！' : '農民勝利！'}</h2>
            <div>倍數：x{roomState.multiplier}</div>
            <button className="lobby-btn" onClick={() => socket.emit('game:restart', {})}>
              再來一局
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
