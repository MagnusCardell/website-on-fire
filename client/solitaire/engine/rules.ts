import type { Card, GameState, Move } from './types';
import { getRankValue, isOppositeColor } from './deck';

// Check if a card can be placed on a foundation pile
export function canPlaceOnFoundation(card: Card, foundationPile: Card[]): boolean {
  if (foundationPile.length === 0) {
    // Only Aces can start a foundation
    return card.rank === 'A';
  }

  const topCard = foundationPile[foundationPile.length - 1];
  // Must be same suit and next rank up
  return card.suit === topCard.suit && getRankValue(card.rank) === getRankValue(topCard.rank) + 1;
}

// Check if a card (or stack starting with card) can be placed on a tableau pile
export function canPlaceOnTableau(card: Card, tableauPile: Card[]): boolean {
  if (tableauPile.length === 0) {
    // Only Kings can be placed on empty tableau
    return card.rank === 'K';
  }

  const topCard = tableauPile[tableauPile.length - 1];
  // Must be opposite color and one rank lower
  return isOppositeColor(card.suit, topCard.suit) && getRankValue(card.rank) === getRankValue(topCard.rank) - 1;
}

// Get all legal moves from current state
export function getLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];

  // Draw from stock (if stock has cards)
  if (state.stock.length > 0) {
    moves.push({
      type: 'draw',
      from: { pile: 'stock', index: 0 },
      to: { pile: 'waste', index: 0 },
      cardIds: state.stock.slice(-3).map((c) => c.id), // Draw 3
    });
  }

  // Recycle waste to stock (if stock is empty and waste has cards)
  if (state.stock.length === 0 && state.waste.length > 0) {
    moves.push({
      type: 'recycle',
      from: { pile: 'waste', index: 0 },
      to: { pile: 'stock', index: 0 },
      cardIds: state.waste.map((c) => c.id),
    });
  }

  // Moves from waste
  if (state.waste.length > 0) {
    const wasteCard = state.waste[state.waste.length - 1];

    // Waste to foundations
    state.foundations.forEach((foundation, i) => {
      if (canPlaceOnFoundation(wasteCard, foundation)) {
        moves.push({
          type: 'waste-to-foundation',
          from: { pile: 'waste', index: 0 },
          to: { pile: 'foundation', index: i },
          cardIds: [wasteCard.id],
        });
      }
    });

    // Waste to tableau
    state.tableau.forEach((tableau, i) => {
      if (canPlaceOnTableau(wasteCard, tableau)) {
        moves.push({
          type: 'waste-to-tableau',
          from: { pile: 'waste', index: 0 },
          to: { pile: 'tableau', index: i },
          cardIds: [wasteCard.id],
        });
      }
    });
  }

  // Moves from tableau
  state.tableau.forEach((fromTableau, fromIndex) => {
    // Find first face-up card in this pile
    const firstFaceUpIndex = fromTableau.findIndex((c) => c.faceUp);
    if (firstFaceUpIndex === -1) return;

    // For each possible starting card (can move stacks)
    for (let cardIndex = firstFaceUpIndex; cardIndex < fromTableau.length; cardIndex++) {
      const movingCards = fromTableau.slice(cardIndex);
      const leadCard = movingCards[0];

      // Tableau to tableau (only if moving changes something)
      state.tableau.forEach((toTableau, toIndex) => {
        if (fromIndex === toIndex) return;
        if (canPlaceOnTableau(leadCard, toTableau)) {
          moves.push({
            type: 'tableau-to-tableau',
            from: { pile: 'tableau', index: fromIndex },
            to: { pile: 'tableau', index: toIndex },
            cardIds: movingCards.map((c) => c.id),
          });
        }
      });

      // Tableau to foundation (only single cards)
      if (movingCards.length === 1) {
        state.foundations.forEach((foundation, foundationIndex) => {
          if (canPlaceOnFoundation(leadCard, foundation)) {
            moves.push({
              type: 'tableau-to-foundation',
              from: { pile: 'tableau', index: fromIndex },
              to: { pile: 'foundation', index: foundationIndex },
              cardIds: [leadCard.id],
            });
          }
        });
      }
    }
  });
  // Foundation to Tableau
  state.foundations.forEach((foundation, foundationIndex) => {
    const topCard = foundation[foundation.length - 1];
    if (!topCard) return;
    state.tableau.forEach((toTableau, toIndex) => {
      if (canPlaceOnTableau(topCard, toTableau)) {
        moves.push({
          type: 'foundation-to-tableau',
          from: { pile: 'foundation', index: foundationIndex },
          to: { pile: 'tableau', index: toIndex },
          cardIds: [topCard.id],
        });
      }
    });
  });

  return moves;
}

// Check if the game is won
export function checkWin(state: GameState): boolean {
  return state.foundations.every((f) => f.length === 13);
}

// Apply a move to the game state (returns new state)
export function applyMove(state: GameState, move: Move): GameState {
  const newState: GameState = {
    ...state,
    stock: [...state.stock],
    waste: [...state.waste],
    foundations: state.foundations.map((f) => [...f]) as GameState['foundations'],
    tableau: state.tableau.map((t) => [...t]) as GameState['tableau'],
    moveHistory: [...state.moveHistory, move],
    moveCount: state.moveCount + 1,
  };

  switch (move.type) {
    case 'draw': {
      // Draw up to 3 cards from stock to waste
      const drawCount = Math.min(3, newState.stock.length);
      const drawnCards = newState.stock.splice(-drawCount).reverse();
      drawnCards.forEach((card) => {
        card.faceUp = true;
      });
      newState.waste.push(...drawnCards);
      break;
    }

    case 'recycle': {
      // Store previous waste state for undo BEFORE modifying
      move.previousWasteState = state.waste.map((c) => ({ ...c }));

      // Move all waste back to stock, face down
      const wasteCards = newState.waste.splice(0);
      wasteCards.reverse();
      wasteCards.forEach((card) => {
        card.faceUp = false;
      });
      newState.stock = wasteCards;
      break;
    }

    case 'waste-to-foundation': {
      const card = newState.waste.pop()!;
      newState.foundations[move.to.index].push(card);
      break;
    }

    case 'waste-to-tableau': {
      const card = newState.waste.pop()!;
      newState.tableau[move.to.index].push(card);
      break;
    }

    case 'tableau-to-tableau': {
      const fromPile = newState.tableau[move.from.index];
      const cardIndex = fromPile.findIndex((c) => c.id === move.cardIds[0]);
      const movingCards = fromPile.splice(cardIndex);
      newState.tableau[move.to.index].push(...movingCards);

      // Flip the new top card if face down
      if (fromPile.length > 0 && !fromPile[fromPile.length - 1].faceUp) {
        fromPile[fromPile.length - 1].faceUp = true;
        move.flippedCardId = fromPile[fromPile.length - 1].id;
      }
      break;
    }

    case 'tableau-to-foundation': {
      const fromPile = newState.tableau[move.from.index];
      const card = fromPile.pop()!;
      newState.foundations[move.to.index].push(card);

      // Flip the new top card if face down
      if (fromPile.length > 0 && !fromPile[fromPile.length - 1].faceUp) {
        fromPile[fromPile.length - 1].faceUp = true;
        move.flippedCardId = fromPile[fromPile.length - 1].id;
      }
      break;
    }

    case 'foundation-to-tableau': {
      const fromFoundationPile = newState.foundations[move.from.index];
      const topCard = fromFoundationPile[fromFoundationPile.length - 1];
      newState.foundations[move.from.index].pop();
      newState.tableau[move.to.index].push(topCard);
      break;
    }
  }

  // Check for win
  if (checkWin(newState)) {
    newState.gameStatus = 'won';
  }

  return newState;
}

// Undo the last move
export function undoMove(state: GameState): GameState | null {
  if (state.moveHistory.length === 0) return null;

  const newState: GameState = {
    ...state,
    stock: [...state.stock],
    waste: [...state.waste],
    foundations: state.foundations.map((f) => [...f]) as GameState['foundations'],
    tableau: state.tableau.map((t) => [...t]) as GameState['tableau'],
    moveHistory: state.moveHistory.slice(0, -1),
    moveCount: state.moveCount, // Don't decrement - track total moves
    gameStatus: 'playing',
  };

  const move = state.moveHistory[state.moveHistory.length - 1];

  switch (move.type) {
    case 'draw': {
      // Move cards back from waste to stock
      const count = move.cardIds.length;
      const cards = newState.waste.splice(-count);
      cards.reverse();
      cards.forEach((card) => {
        card.faceUp = false;
      });
      newState.stock.push(...cards);
      break;
    }

    case 'recycle': {
      // Restore previous waste state
      if (move.previousWasteState) {
        newState.waste = move.previousWasteState;
        newState.stock = [];
      }
      break;
    }

    case 'waste-to-foundation': {
      const card = newState.foundations[move.to.index].pop()!;
      newState.waste.push(card);
      break;
    }

    case 'waste-to-tableau': {
      const card = newState.tableau[move.to.index].pop()!;
      newState.waste.push(card);
      break;
    }

    case 'tableau-to-tableau': {
      // Un-flip the card that was flipped
      if (move.flippedCardId) {
        const fromPile = newState.tableau[move.from.index];
        const card = fromPile.find((c) => c.id === move.flippedCardId);
        if (card) card.faceUp = false;
      }

      // Move cards back
      const toPile = newState.tableau[move.to.index];
      const cardIndex = toPile.findIndex((c) => c.id === move.cardIds[0]);
      const movingCards = toPile.splice(cardIndex);
      newState.tableau[move.from.index].push(...movingCards);
      break;
    }

    case 'tableau-to-foundation': {
      // Un-flip the card that was flipped
      if (move.flippedCardId) {
        const fromPile = newState.tableau[move.from.index];
        const card = fromPile.find((c) => c.id === move.flippedCardId);
        if (card) card.faceUp = false;
      }

      // Move card back
      const card = newState.foundations[move.to.index].pop()!;
      newState.tableau[move.from.index].push(card);
      break;
    }

    case 'foundation-to-tableau': {
      const card = newState.tableau[move.to.index].pop()!;
      newState.foundations[move.from.index].push(card);
      break;
    }
  }

  return newState;
}
