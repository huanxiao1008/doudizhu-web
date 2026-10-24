import React from 'react';
import { cardLabel, cardClassName } from '../cardUtils';

export default function Card({ card, selected, onClick, small }) {
  return (
    <div
      className={`card ${cardClassName(card)} ${selected ? 'selected' : ''} ${small ? 'small' : ''}`}
      onClick={onClick}
    >
      {cardLabel(card)}
    </div>
  );
}
