const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { Server } = require('socket.io');
const { RoomManager } = require('./roomManager');
const { PHASE } = require('./game/room');
const { aiDecideBid, aiChooseMove } = require('./game/ai');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const roomManager = new RoomManager();

// playerId -> { roomId, seat, socketId }
const playerSessions = new Map();

function broadcastRoomState(room) {
  for (const seat of room.seats) {
    if (!seat || seat.isAI) continue;
    const seatIdx = room.getSeatByPlayerId(seat.playerId);
    io.to(seat.playerId).emit('room:state', room.getPublicState(seatIdx));
  }
}

function emitError(socket, message) {
  socket.emit('game:error', { message });
}

/** 若 AI 需要行動（叫地主或出牌），自動執行，並持续递归处理直到轮到真人或游戏结束 */
function runAIIfNeeded(room) {
  if (room.phase === PHASE.BIDDING) {
    const seat = room.currentBidder;
    const seatInfo = room.seats[seat];
    if (seatInfo && seatInfo.isAI) {
      const willing = aiDecideBid(room.hands[seat]);
      room.handleBid(seat, willing);
      broadcastRoomState(room);
      setTimeout(() => runAIIfNeeded(room), 600);
      return;
    }
  } else if (room.phase === PHASE.PLAYING) {
    const seat = room.turn;
    const seatInfo = room.seats[seat];
    if (seatInfo && seatInfo.isAI) {
      const hand = room.hands[seat];
      const lastPattern = room.lastPlayedSeat === seat ? null : room.lastPattern;
      const move = aiChooseMove(hand, lastPattern);
      const cardIds = move ? move.map((c) => c.id) : [];
      room.handlePlay(seat, cardIds);
      broadcastRoomState(room);
      if (room.phase === PHASE.PLAYING) {
        setTimeout(() => runAIIfNeeded(room), 800);
      }
      return;
    }
  }
}

io.on('connection', (socket) => {
  // 建立房间：回传 roomId
  socket.on('room:create', ({ name }, callback) => {
    const room = roomManager.createRoom();
    const seatIdx = room.addPlayer(socket.id, name || '玩家');
    playerSessions.set(socket.id, { roomId: room.id, seat: seatIdx });
    socket.join(socket.id); // 用 socket.id 作为私有频道，方便定向推送手牌
    socket.join(room.id);
    callback({ ok: true, roomId: room.id, seat: seatIdx });
    broadcastRoomState(room);
  });

  // 加入已存在房间
  socket.on('room:join', ({ roomId, name }, callback) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return callback({ ok: false, error: '找不到這個房間號碼' });
    if (room.isFull()) return callback({ ok: false, error: '房間已満' });
    const seatIdx = room.addPlayer(socket.id, name || '玩家');
    playerSessions.set(socket.id, { roomId: room.id, seat: seatIdx });
    socket.join(socket.id);
    socket.join(room.id);
    callback({ ok: true, roomId: room.id, seat: seatIdx });
    broadcastRoomState(room);
  });

  // 房主請求 AI 補位空位
  socket.on('room:fillAI', (_data, callback) => {
    const session = playerSessions.get(socket.id);
    if (!session) return callback && callback({ ok: false, error: '尚未加入房間' });
    const room = roomManager.getRoom(session.roomId);
    if (!room) return callback && callback({ ok: false, error: '房間不存在' });
    let filled = 0;
    for (let i = 0; i < 3; i++) {
      if (room.seats[i] === null) {
        room.addAI(i);
        filled++;
      }
    }
    callback && callback({ ok: true, filled });
    broadcastRoomState(room);
  });

  // 房主開始遊戲
  socket.on('game:start', (_data, callback) => {
    const session = playerSessions.get(socket.id);
    if (!session) return callback && callback({ ok: false, error: '尚未加入房間' });
    const room = roomManager.getRoom(session.roomId);
    if (!room) return callback && callback({ ok: false, error: '房間不存在' });
    if (!room.isFull()) return callback && callback({ ok: false, error: '人數不足，請等待玩家加入或補位AI' });
    room.startGame();
    callback && callback({ ok: true });
    broadcastRoomState(room);
    runAIIfNeeded(room);
  });

  // 叫地主
  socket.on('game:bid', ({ bid }, callback) => {
    const session = playerSessions.get(socket.id);
    if (!session) return callback && callback({ ok: false, error: '尚未加入房間' });
    const room = roomManager.getRoom(session.roomId);
    if (!room) return callback && callback({ ok: false, error: '房間不存在' });
    const result = room.handleBid(session.seat, bid);
    if (result.error) {
      callback && callback({ ok: false, error: result.error });
      return;
    }
    callback && callback({ ok: true });
    broadcastRoomState(room);
    runAIIfNeeded(room);
  });

  // 出牌
  socket.on('game:play', ({ cardIds }, callback) => {
    const session = playerSessions.get(socket.id);
    if (!session) return callback && callback({ ok: false, error: '尚未加入房間' });
    const room = roomManager.getRoom(session.roomId);
    if (!room) return callback && callback({ ok: false, error: '房間不存在' });
    const result = room.handlePlay(session.seat, cardIds || []);
    if (result.error) {
      callback && callback({ ok: false, error: result.error });
      return;
    }
    callback && callback({ ok: true });
    broadcastRoomState(room);
    runAIIfNeeded(room);
  });

  // 再来一局（結算畫面點擊後重新發牌，座位不変）
  socket.on('game:restart', (_data, callback) => {
    const session = playerSessions.get(socket.id);
    if (!session) return callback && callback({ ok: false, error: '尚未加入房間' });
    const room = roomManager.getRoom(session.roomId);
    if (!room) return callback && callback({ ok: false, error: '房間不存在' });
    room.startGame();
    callback && callback({ ok: true });
    broadcastRoomState(room);
    runAIIfNeeded(room);
  });

  // 局內快捷訊息
  socket.on('chat:quick', ({ text }) => {
    const session = playerSessions.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;
    io.to(room.id).emit('chat:message', { seat: session.seat, text });
  });

  // 局內互動道具（番茄/水桐/雞蛋等），target 為座位 index
  socket.on('interact:throw', ({ itemType, targetSeat }) => {
    const session = playerSessions.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (!room) return;
    io.to(room.id).emit('interact:thrown', {
      fromSeat: session.seat,
      targetSeat,
      itemType,
    });
  });

  socket.on('disconnect', () => {
    const session = playerSessions.get(socket.id);
    if (!session) return;
    const room = roomManager.getRoom(session.roomId);
    if (room && room.seats[session.seat]) {
      room.seats[session.seat].connected = false;
    }
    playerSessions.delete(socket.id);
    if (room) broadcastRoomState(room);
  });
});

// 定期清理長時間無人的房間
setInterval(() => roomManager.cleanupStaleRooms(), 1000 * 60 * 30);

// 提供前端靜態檔案（build 後的 dist）
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`鬥地主伺服器啟動於 port ${PORT}`);
});
