// 鬥地主牌面定義與牌型判斷邏輯
// 牌用 rank 數值表示大小：3-10 為原值，J=11, Q=12, K=13, A=14, 2=15, 小王=16, 大王=17

const SUITS = ['S', 'H', 'C', 'D']; // 黑桃 紅心 梅花 方塊
const RANKS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]; // 3~2

const RANK_LABEL = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2', 16: '小王', 17: '大王',
};

const SUIT_LABEL = { S: '♠', H: '♥', C: '♣', D: '♦' };

/** 建立一副新牌（54張），回傳 card 物件陣列 { id, rank, suit } */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${suit}${rank}`, rank, suit });
    }
  }
  deck.push({ id: 'JOKER_SMALL', rank: 16, suit: null }); // 小王
  deck.push({ id: 'JOKER_BIG', rank: 17, suit: null }); // 大王
  return deck;
}

/** Fisher-Yates 洗牌 */
function shuffle(deck) {
  const arr = deck.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 發牌：回傳 { hands: [17,17,17], bottom: [3] } */
function dealCards() {
  const deck = shuffle(createDeck());
  const hands = [deck.slice(0, 17), deck.slice(17, 34), deck.slice(34, 51)];
  const bottom = deck.slice(51, 54);
  return { hands, bottom };
}

function sortCards(cards) {
  return cards.slice().sort((a, b) => a.rank - b.rank);
}

function cardLabel(card) {
  if (card.rank === 16) return '小王';
  if (card.rank === 17) return '大王';
  return `${SUIT_LABEL[card.suit]}${RANK_LABEL[card.rank]}`;
}

module.exports = {
  SUITS, RANKS, RANK_LABEL, SUIT_LABEL,
  createDeck, shuffle, dealCards, sortCards, cardLabel,
};
