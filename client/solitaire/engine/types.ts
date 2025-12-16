// Card and game state types for Klondike Solitaire

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  faceUp: boolean;
}

export type PileType = 'stock' | 'waste' | 'foundation' | 'tableau';

export interface Pile {
  id: string;
  type: PileType;
  cards: Card[];
  index: number; // 0-3 for foundations, 0-6 for tableau
}

export interface GameState {
  stock: Card[];
  waste: Card[];
  foundations: [Card[], Card[], Card[], Card[]]; // 4 foundation piles (one per suit order doesn't matter)
  tableau: [Card[], Card[], Card[], Card[], Card[], Card[], Card[]]; // 7 tableau piles
  seed: number;
  moveHistory: Move[];
  gameStatus: 'playing' | 'won' | 'lost';
  elapsedActiveMs: number; // Accumulated active play time in milliseconds
  moveCount: number;
}

export type MoveType = 
  | 'draw' // Draw from stock to waste
  | 'recycle' // Recycle waste back to stock
  | 'waste-to-tableau'
  | 'waste-to-foundation'
  | 'foundation-to-tableau'
  | 'tableau-to-tableau'
  | 'tableau-to-foundation'
  | 'flip-tableau'; // Flip top tableau card face-up

export interface Move {
  type: MoveType;
  from: { pile: PileType; index: number };
  to: { pile: PileType; index: number };
  cardIds: string[]; // Cards involved in the move
  flippedCardId?: string; // Card that was flipped face-up as result
  previousWasteState?: Card[]; // For undo of recycle
}

export interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  bestStreak: number;
  bestTime?: number; // seconds
  totalPlayTime: number; // seconds
}

export interface SavedGame {
  state: GameState;
  stats: GameStats;
  lastSaved: number;
}

// Position for animation
export interface CardPosition {
  x: number;
  y: number;
  z: number;
  rotation: number;
}
