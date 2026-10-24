// 牌型識別與比較邏輯
// 牌型: SINGLE, PAIR, TRIO, TRIO_SOLO(三帶一), TRIO_PAIR(三帶對),
//       STRAIGHT(順子), STRAIGHT_PAIR(連對), PLANE(飛機,不帶/帶單/帶對),
//       BOMB(炸彈), ROCKET(王炸), FOUR_TWO(四帶二單/四帶二對)

/** 依 rank 分組計數，回傳 Map<rank, count> */
function countByRank(cards) {
  const map = new Map();
  for (const c of cards) {
    map.set(c.rank, (map.get(c.rank) || 0) + 1);
  }
  return map;
}

/** 判斷是否為連續的 rank 序列（不可含 2(15) 或王(16,17)） */
function isConsecutive(ranks) {
  const sorted = [...ranks].sort((a, b) => a - b);
  for (const r of sorted) {
    if (r >= 15) return false; // 順子/連對/飛機不可含 2、王
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

/**
 * 識別一組牌的牌型
 * @param {Array} cards 牌物件陣列
 * @returns {Object|null} { type, rank, length, kickers } 或 null（不是合法牌型）
 *   rank 為用於比較大小的主值（如對子的點數、炸彈的點數）
 */
function identifyPattern(cards) {
  if (!cards || cards.length === 0) return null;
  const n = cards.length;
  const counts = countByRank(cards);
  const ranks = [...counts.keys()];
  const countValues = [...counts.values()];

  // 王炸：小王+大王
  if (n === 2 && ranks.includes(16) && ranks.includes(17)) {
    return { type: 'ROCKET', rank: 1000, length: 1 };
  }

  // 單張
  if (n === 1) {
    return { type: 'SINGLE', rank: cards[0].rank, length: 1 };
  }

  // 對子（不可用王配對，王只能單獨出或組王炸）
  if (n === 2 && countValues[0] === 2 && ranks[0] < 16) {
    return { type: 'PAIR', rank: ranks[0], length: 1 };
  }

  // 炸彈：四張同點數
  if (n === 4 && countValues.length === 1 && countValues[0] === 4) {
    return { type: 'BOMB', rank: ranks[0], length: 1 };
  }

  // 三張（不帶）
  if (n === 3 && countValues.length === 1 && countValues[0] === 3) {
    return { type: 'TRIO', rank: ranks[0], length: 1 };
  }

  // 三帶一：3+1，三张点数 trioRank，单张作为 kicker（不能是王，三带一的单张可以是任意非三张点数的牌）
  if (n === 4) {
    const trioRank = [...counts.entries()].find(([, c]) => c === 3);
    const soloRank = [...counts.entries()].find(([, c]) => c === 1);
    if (trioRank && soloRank) {
      return { type: 'TRIO_SOLO', rank: trioRank[0], length: 1, kickers: [soloRank[0]] };
    }
  }

  // 三带对：3+2
  if (n === 5) {
    const trioRank = [...counts.entries()].find(([, c]) => c === 3);
    const pairRank = [...counts.entries()].find(([, c]) => c === 2);
    if (trioRank && pairRank) {
      return { type: 'TRIO_PAIR', rank: trioRank[0], length: 1, kickers: [pairRank[0]] };
    }
  }

  // 四带二（单）：4+1+1，共6张
  if (n === 6) {
    const fourRank = [...counts.entries()].find(([, c]) => c === 4);
    const solos = [...counts.entries()].filter(([, c]) => c === 1);
    if (fourRank && solos.length === 2) {
      return { type: 'FOUR_TWO_SOLO', rank: fourRank[0], length: 1, kickers: solos.map(([r]) => r) };
    }
  }

  // 四带二（对）：4+2+2，共8张
  if (n === 8) {
    const fourRank = [...counts.entries()].find(([, c]) => c === 4);
    const pairs = [...counts.entries()].filter(([, c]) => c === 2);
    if (fourRank && pairs.length === 2) {
      return { type: 'FOUR_TWO_PAIR', rank: fourRank[0], length: 1, kickers: pairs.map(([r]) => r) };
    }
  }

  // 顺子：5张以上连续单张，不可含2/王
  if (n >= 5 && countValues.every((c) => c === 1)) {
    if (isConsecutive(ranks)) {
      return { type: 'STRAIGHT', rank: Math.min(...ranks), length: n };
    }
  }

  // 连对：3对以上连续对子
  if (n >= 6 && n % 2 === 0 && countValues.every((c) => c === 2)) {
    if (isConsecutive(ranks)) {
      return { type: 'STRAIGHT_PAIR', rank: Math.min(...ranks), length: n / 2 };
    }
  }

  // 飞机：2组以上连续三张，可不带/带单/带对
  // 先抓出所有三张的点数组
  const trioRanks = [...counts.entries()].filter(([, c]) => c === 3).map(([r]) => r);
  if (trioRanks.length >= 2 && isConsecutive(trioRanks)) {
    const planeLen = trioRanks.length;
    const usedCards = planeLen * 3;
    const remaining = n - usedCards;
    if (remaining === 0) {
      return { type: 'PLANE', rank: Math.min(...trioRanks), length: planeLen };
    }
    // 飞机带单翼：剩余必须恰好是 planeLen 个单张（点数不可与飞机重复，且不可是多组成对的混合）
    if (remaining === planeLen) {
      const kickerRanks = [...counts.entries()].filter(([r, c]) => c === 1 && !trioRanks.includes(r));
      const totalSingles = kickerRanks.reduce((s, [, c]) => s + c, 0);
      if (kickerRanks.length === planeLen && totalSingles === planeLen) {
        return { type: 'PLANE_SOLO', rank: Math.min(...trioRanks), length: planeLen, kickers: kickerRanks.map(([r]) => r) };
      }
    }
    // 飞机带对翼：剩余必须恰好是 planeLen 组对子
    if (remaining === planeLen * 2) {
      const kickerPairs = [...counts.entries()].filter(([r, c]) => c === 2 && !trioRanks.includes(r));
      if (kickerPairs.length === planeLen) {
        return { type: 'PLANE_PAIR', rank: Math.min(...trioRanks), length: planeLen, kickers: kickerPairs.map(([r]) => r) };
      }
    }
  }

  return null; // 不是合法牌型
}

/** 同类型可比较大小：回傳 true 表示 a 比 b 大，可以压过去 */
function canBeat(a, b) {
  if (!a) return false;
  if (!b) return true; // b 为 null 表示本轮还没人出牌（不应该走到这里，由外层处理）
  // 王炸最大，谁都压不过
  if (b.type === 'ROCKET') return false;
  if (a.type === 'ROCKET') return true;
  // 炸弹可以压过非炸弹的任何牌型，炸弹之间比点数
  if (a.type === 'BOMB' && b.type !== 'BOMB') return true;
  if (a.type === 'BOMB' && b.type === 'BOMB') return a.rank > b.rank;
  if (a.type !== 'BOMB' && b.type === 'BOMB') return false;
  // 一般情况：必须同类型且同长度（如顺子长度要一致）
  if (a.type !== b.type) return false;
  if (a.length !== b.length) return false;
  return a.rank > b.rank;
}

module.exports = { identifyPattern, canBeat, countByRank, isConsecutive };
