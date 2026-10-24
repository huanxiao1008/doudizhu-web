// 簡易 AI 出牌邏輯：給 AI 補位玩家使用
const { identifyPattern, canBeat } = require('./patterns');
const { countByRank } = require('./patterns');

/** AI 決定是否叫地主：手牌有炸彈/王/大牌多就叫 */
function aiDecideBid(hand) {
  let score = 0;
  for (const c of hand) {
    if (c.rank === 17) score += 4; // 大王
    else if (c.rank === 16) score += 3; // 小王
    else if (c.rank === 15) score += 2; // 2
    else if (c.rank === 14) score += 1; // A
  }
  const counts = countByRank(hand);
  for (const c of counts.values()) {
    if (c === 4) score += 3; // 炸弹
  }
  // score 越高越愿意叫地主，随机加一点扰动避免AI太死板
  const willing = score >= 4 || Math.random() < 0.15;
  return willing;
}

/** 列出手牌中所有可能的合法出牌组合（简化版：只列常见组合，不做全穷举飞机接龙等复杂型） */
function enumerateMoves(hand) {
  const moves = [];
  const counts = countByRank(hand);
  const ranksSorted = [...counts.keys()].sort((a, b) => a - b);

  // 单张
  for (const r of ranksSorted) {
    const card = hand.find((c) => c.rank === r);
    moves.push([card]);
  }
  // 对子
  for (const r of ranksSorted) {
    if (counts.get(r) >= 2) {
      const cards = hand.filter((c) => c.rank === r).slice(0, 2);
      moves.push(cards);
    }
  }
  // 三张 / 三带一 / 三带对
  for (const r of ranksSorted) {
    if (counts.get(r) >= 3) {
      const trio = hand.filter((c) => c.rank === r).slice(0, 3);
      moves.push(trio);
      const others = hand.filter((c) => c.rank !== r);
      if (others.length > 0) {
        moves.push([...trio, others[0]]);
      }
      const otherPairRank = [...counts.keys()].find((rr) => rr !== r && counts.get(rr) >= 2);
      if (otherPairRank !== undefined) {
        const pair = hand.filter((c) => c.rank === otherPairRank).slice(0, 2);
        moves.push([...trio, ...pair]);
      }
    }
  }
  // 炸弹
  for (const r of ranksSorted) {
    if (counts.get(r) === 4) {
      moves.push(hand.filter((c) => c.rank === r));
    }
  }
  // 王炸
  const smallJoker = hand.find((c) => c.rank === 16);
  const bigJoker = hand.find((c) => c.rank === 17);
  if (smallJoker && bigJoker) {
    moves.push([smallJoker, bigJoker]);
  }
  // 顺子（5~12张，从每个起点尝试最长再往下缩）
  for (let start = 0; start < ranksSorted.length; start++) {
    const startRank = ranksSorted[start];
    if (startRank >= 15) continue;
    let len = 1;
    while (
      startRank + len <= 14 &&
      counts.has(startRank + len)
    ) {
      len++;
    }
    for (let l = len; l >= 5; l--) {
      const cards = [];
      for (let i = 0; i < l; i++) {
        cards.push(hand.find((c) => c.rank === startRank + i && !cards.includes(c)));
      }
      if (cards.every(Boolean)) moves.push(cards);
    }
  }
  // 连对（3对以上）
  for (let start = 0; start < ranksSorted.length; start++) {
    const startRank = ranksSorted[start];
    if (startRank >= 15) continue;
    let len = 1;
    while (
      startRank + len <= 14 &&
      counts.has(startRank + len) &&
      counts.get(startRank + len) >= 2
    ) {
      len++;
    }
    if (counts.get(startRank) < 2) continue;
    for (let l = len; l >= 3; l--) {
      const cards = [];
      for (let i = 0; i < l; i++) {
        const pair = hand.filter((c) => c.rank === startRank + i).slice(0, 2);
        cards.push(...pair);
      }
      if (cards.length === l * 2) moves.push(cards);
    }
  }

  return moves;
}

/**
 * AI 選擇出牌：lastPattern 為上一個有效出牌的 pattern（null 表示本輪自由出牌）
 * @returns {Array|null} 選擇要出的牌陣列，或 null 表示不出（過牌）
 */
function aiChooseMove(hand, lastPattern, { mustPlay = false } = {}) {
  const moves = enumerateMoves(hand);
  const candidates = [];
  for (const move of moves) {
    const pattern = identifyPattern(move);
    if (!pattern) continue;
    if (lastPattern === null) {
      candidates.push({ move, pattern });
    } else if (canBeat(pattern, lastPattern)) {
      candidates.push({ move, pattern });
    }
  }

  if (candidates.length === 0) {
    return null; // 没有能出的牌，过牌（若 mustPlay 则由外层处理，通常不会发生在自由出牌时）
  }

  // 自由出牌时（新一轮）：优先出最小的非炸弹组合，尽量打出手牌数量多的组合清理手牌
  // 跟牌时（压制）：优先用刚好能压过的最小牌，保留大牌
  candidates.sort((a, b) => {
    // 优先不拆炸弹/王炸
    const aBomb = a.pattern.type === 'BOMB' || a.pattern.type === 'ROCKET';
    const bBomb = b.pattern.type === 'BOMB' || b.pattern.type === 'ROCKET';
    if (aBomb !== bBomb) return aBomb ? 1 : -1;
    return a.pattern.rank - b.pattern.rank;
  });

  // 若是跟牌（lastPattern 存在）且手牌剩余很少，才考虑用炸弹；否则尽量不用炸弹保留着
  if (lastPattern !== null) {
    const nonBomb = candidates.filter((c) => c.pattern.type !== 'BOMB' && c.pattern.type !== 'ROCKET');
    if (nonBomb.length > 0) return nonBomb[0].move;
    // 只剩炸弹/王炸能压：手牌很少时才打，否则选择过牌保留炸弹
    if (hand.length <= 6) return candidates[0].move;
    return null;
  }

  return candidates[0].move;
}

module.exports = { aiDecideBid, aiChooseMove, enumerateMoves };
