// 房间与对局状态机
const { dealCards, sortCards, cardLabel } = require('./cards');
const { identifyPattern, canBeat } = require('./patterns');
const { aiDecideBid, aiChooseMove } = require('./ai');

const PHASE = {
  WAITING: 'WAITING', // 等待玩家加入/AI补位
  BIDDING: 'BIDDING', // 叫地主阶段
  PLAYING: 'PLAYING', // 出牌阶段
  FINISHED: 'FINISHED', // 本局结束，显示结算
};

function makeRoomId() {
  // 简单6位数字房号，方便同学口头互相告知
  return String(Math.floor(100000 + Math.random() * 900000));
}

class Room {
  constructor(id, hostSeatName) {
    this.id = id;
    this.phase = PHASE.WAITING;
    // seats: 固定3位，每位 { playerId, name, isAI, connected }
    this.seats = [null, null, null];
    this.hands = [[], [], []]; // 每位玩家手牌
    this.bottom = []; // 底牌3张
    this.landlordSeat = null; // 地主座位 index
    this.currentBidder = null; // 当前叫地主的座位 index
    this.bidPasses = 0; // 连续几人不叫
    this.lastPattern = null; // 当前这一轮最后一个有效出牌
    this.lastPlayedSeat = null; // 最后出牌的座位（用于判断是否一圈都过牌）
    this.turn = null; // 当前该谁出牌，座位 index
    this.history = []; // 出牌历史 [{seat, cards, pattern}]
    this.multiplier = 1; // 倍数（叫地主倍数 * 炸弹倍数）
    this.winnerSeat = null; // 结算：谁先出完牌
    this.winningTeam = null; // 'landlord' | 'farmer'
    this.createdAt = Date.now();
  }

  findEmptySeat() {
    return this.seats.findIndex((s) => s === null);
  }

  addPlayer(playerId, name) {
    const idx = this.findEmptySeat();
    if (idx === -1) return -1;
    this.seats[idx] = { playerId, name, isAI: false, connected: true };
    return idx;
  }

  addAI(seatIdx) {
    if (this.seats[seatIdx] !== null) return false;
    this.seats[seatIdx] = {
      playerId: `AI_${this.id}_${seatIdx}`,
      name: `電腦玩家${seatIdx + 1}`,
      isAI: true,
      connected: true,
    };
    return true;
  }

  isFull() {
    return this.seats.every((s) => s !== null);
  }

  getSeatByPlayerId(playerId) {
    return this.seats.findIndex((s) => s && s.playerId === playerId);
  }

  /** 開始遊戲：發牌，進入叫地主階段 */
  startGame() {
    const { hands, bottom } = dealCards();
    this.hands = hands.map(sortCards);
    this.bottom = bottom;
    this.phase = PHASE.BIDDING;
    this.landlordSeat = null;
    this.currentBidder = Math.floor(Math.random() * 3); // 随机一人先叫
    this.bidPasses = 0;
    this.lastPattern = null;
    this.lastPlayedSeat = null;
    this.turn = null;
    this.history = [];
    this.multiplier = 1;
    this.winnerSeat = null;
    this.winningTeam = null;
  }

  /** 處理叫地主：seatIdx 玩家選擇 bid(true=叫) 或不叫(false) */
  handleBid(seatIdx, bid) {
    if (this.phase !== PHASE.BIDDING) return { error: '目前不是叫地主階段' };
    if (seatIdx !== this.currentBidder) return { error: '還沒輪到你叫地主' };

    if (bid) {
      // 叫地主：该玩家成为地主，补 3张底牌
      this.landlordSeat = seatIdx;
      this.hands[seatIdx] = sortCards([...this.hands[seatIdx], ...this.bottom]);
      this.phase = PHASE.PLAYING;
      this.turn = seatIdx;
      this.multiplier = 1;
      return { landlordSeat: seatIdx };
    }

    this.bidPasses++;
    if (this.bidPasses >= 3) {
      // 三人都不叫，重新发牌
      this.startGame();
      return { redeal: true };
    }
    this.currentBidder = (this.currentBidder + 1) % 3;
    return { nextBidder: this.currentBidder };
  }

  /** 處理出牌：seatIdx 出 cardIds 陣列（空陣列表示過牌） */
  handlePlay(seatIdx, cardIds) {
    if (this.phase !== PHASE.PLAYING) return { error: '目前不是出牌階段' };
    if (seatIdx !== this.turn) return { error: '還沒輪到你出牌' };

    if (!cardIds || cardIds.length === 0) {
      // 过牌：只有在 lastPattern 存在（即不是本轮第一个出牌的人）时才允许
      if (this.lastPattern === null) {
        return { error: '你必須出牌（本輪第一個出牌不能過）' };
      }
      this.advanceTurn();
      return { passed: true, seat: seatIdx };
    }

    const hand = this.hands[seatIdx];
    const cards = cardIds.map((id) => hand.find((c) => c.id === id)).filter(Boolean);
    if (cards.length !== cardIds.length) {
      return { error: '出牌無效：手牌中找不到對應的牌' };
    }

    const pattern = identifyPattern(cards);
    if (!pattern) {
      return { error: '不是合法的牌型' };
    }

    if (this.lastPattern !== null && this.lastPlayedSeat !== seatIdx) {
      if (!canBeat(pattern, this.lastPattern)) {
        return { error: '出的牌無法壓過上一手' };
      }
    }

    // 执行出牌：从手牌移除
    const cardIdSet = new Set(cardIds);
    this.hands[seatIdx] = hand.filter((c) => !cardIdSet.has(c.id));
    this.lastPattern = pattern;
    this.lastPlayedSeat = seatIdx;
    this.history.push({ seat: seatIdx, cards, pattern });

    if (pattern.type === 'BOMB') this.multiplier *= 2;
    if (pattern.type === 'ROCKET') this.multiplier *= 2;

    // 判断是否打完手牌
    if (this.hands[seatIdx].length === 0) {
      this.phase = PHASE.FINISHED;
      this.winnerSeat = seatIdx;
      this.winningTeam = seatIdx === this.landlordSeat ? 'landlord' : 'farmer';
      return { finished: true, winnerSeat: seatIdx, cards, pattern };
    }

    this.advanceTurn();
    return { played: true, seat: seatIdx, cards, pattern };
  }

  advanceTurn() {
    this.turn = (this.turn + 1) % 3;
    // 若轮到的人正是最后出牌的人，说明其他两人都过牌了，本轮结束，lastPattern 重置为 null（可自由出牌）
    if (this.turn === this.lastPlayedSeat) {
      this.lastPattern = null;
    }
  }

  /** 供序列化給前端用的状态快照（隠藏其他人手牌內容，只給數量） */
  getPublicState(forSeat) {
    return {
      roomId: this.id,
      phase: this.phase,
      seats: this.seats.map((s, i) => (s ? {
        name: s.name,
        isAI: s.isAI,
        connected: s.connected,
        cardCount: this.hands[i] ? this.hands[i].length : 0,
        isLandlord: i === this.landlordSeat,
      } : null)),
      bottom: this.phase === PHASE.BIDDING || this.phase === PHASE.WAITING ? null : this.bottom,
      currentBidder: this.currentBidder,
      turn: this.turn,
      landlordSeat: this.landlordSeat,
      multiplier: this.multiplier,
      lastPattern: this.lastPattern,
      lastPlayedSeat: this.lastPlayedSeat,
      history: this.history.slice(-10).map((h) => ({
        seat: h.seat,
        cards: h.cards.map((c) => ({ id: c.id, rank: c.rank, suit: c.suit })),
      })),
      myHand: forSeat !== null && forSeat !== undefined && this.hands[forSeat]
        ? this.hands[forSeat].map((c) => ({ id: c.id, rank: c.rank, suit: c.suit }))
        : [],
      winnerSeat: this.winnerSeat,
      winningTeam: this.winningTeam,
    };
  }
}

module.exports = { Room, PHASE, makeRoomId };
