// 房間管理器：管理所有進行中的房間，提供建房/加入/查找
const { Room, makeRoomId } = require('./game/room');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
  }

  createRoom() {
    let id = makeRoomId();
    while (this.rooms.has(id)) id = makeRoomId();
    const room = new Room(id);
    this.rooms.set(id, room);
    return room;
  }

  getRoom(id) {
    return this.rooms.get(id) || null;
  }

  removeRoom(id) {
    this.rooms.delete(id);
  }

  /** 清理超過一定時間沒人連線的房間，避免內存泄漏積翯 */
  cleanupStaleRooms(maxAgeMs = 1000 * 60 * 60 * 6) {
    const now = Date.now();
    for (const [id, room] of this.rooms.entries()) {
      const allDisconnected = room.seats.every((s) => !s || s.isAI || !s.connected);
      if (allDisconnected && now - room.createdAt > maxAgeMs) {
        this.rooms.delete(id);
      }
    }
  }
}

module.exports = { RoomManager };
