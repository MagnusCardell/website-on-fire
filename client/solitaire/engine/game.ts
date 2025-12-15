import type { GameState } from './types';
import { createDeck } from './deck';
import { createSeededRandom, shuffleArray, generateSeed } from './shuffle';

export function createNewGame(seed?: number): GameState {
  const gameSeed = seed ?? generateSeed();
  const random = createSeededRandom(gameSeed);
  const deck = shuffleArray(createDeck(), random);
  
  // Deal tableau
  const tableau: GameState['tableau'] = [[], [], [], [], [], [], []];
  let cardIndex = 0;
  
  for (let col = 0; col < 7; col++) {
    for (let row = col; row < 7; row++) {
      const card = { ...deck[cardIndex++] };
      // Top card of each pile is face up
      card.faceUp = row === col;
      tableau[row].push(card);
    }
  }
  
  // Remaining cards go to stock (face down)
  const stock = deck.slice(cardIndex).map(card => ({
    ...card,
    faceUp: false,
  }));
  
  return {
    stock,
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    seed: gameSeed,
    moveHistory: [],
    gameStatus: 'playing',
    elapsedActiveMs: 0,
    moveCount: 0,
  };
}
