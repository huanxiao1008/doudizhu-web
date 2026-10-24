const RANK_LABEL = {
  3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '2',
};
const SUIT_SYMBOL = { S: '♠', H: '♥', C: '♣', D: '♦' };
const RED_SUITS = new Set(['H', 'D']);

export function cardLabel(card) {
  if (card.rank === 16) return '小王';
  if (card.rank === 17) return '大王';
  return `${SUIT_SYMBOL[card.suit]}${RANK_LABEL[card.rank]}`;
}

export function cardClassName(card) {
  if (card.rank === 17) return 'joker-big';
  if (card.rank === 16) return 'joker-small';
  if (RED_SUITS.has(card.suit)) return 'red';
  return '';
}

export function sortHand(cards) {
  return [...cards].sort((a, b) => a.rank - b.rank);
}
