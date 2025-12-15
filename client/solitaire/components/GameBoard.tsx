import React, { useCallback, useMemo } from 'react';
import type { GameState, Card as CardType, Move } from '../engine/types';
import { Pile } from './Pile';
import { DragOverlay } from './DragOverlay';
import { usePointer, type DragState } from '../hooks/usePointer';
import { canPlaceOnFoundation } from '../engine/rules';

interface GameBoardProps {
  gameState: GameState;
  isSelected: (cardId: string) => boolean;
  getValidDropTargets: (cardId: string) => { pile: 'foundation' | 'tableau'; index: number }[];
  onDrawFromStock: () => void;
  onSelectCard: (cardId: string, fromPile: 'waste' | 'tableau', fromIndex: number) => void;
  onMoveSelectionTo: (toPile: 'foundation' | 'tableau', toIndex: number) => boolean;
  onClearSelection: () => void;
  findLegalMove: (
    cardId: string,
    fromPile: 'waste' | 'tableau',
    fromIndex: number,
    toPile: 'foundation' | 'tableau',
    toIndex: number
  ) => Move | null;
  executeMove: (move: Move) => void;
}

export function GameBoard({
  gameState,
  isSelected,
  getValidDropTargets,
  onDrawFromStock,
  onSelectCard,
  onMoveSelectionTo,
  onClearSelection,
  findLegalMove,
  executeMove,
}: GameBoardProps) {
  // Get all cards for drag overlay lookup
  const allCards = useMemo(() => {
    const cards: CardType[] = [
      ...gameState.stock,
      ...gameState.waste,
      ...gameState.foundations.flat(),
      ...gameState.tableau.flat(),
    ];
    return new Map(cards.map(c => [c.id, c]));
  }, [gameState]);

  const handleDragStart = useCallback((cardId: string, fromPile: 'waste' | 'tableau', fromIndex: number): string[] => {
    if (fromPile === 'tableau') {
      const pile = gameState.tableau[fromIndex];
      const cardIndex = pile.findIndex(c => c.id === cardId);
      if (cardIndex === -1) return [cardId];
      return pile.slice(cardIndex).map(c => c.id);
    }
    return [cardId];
  }, [gameState.tableau]);

  const handleDragEnd = useCallback((drag: DragState, dropTarget: { pile: 'foundation' | 'tableau'; index: number } | null) => {
    if (!dropTarget) {
      // Invalid drop - will spring back automatically
      return;
    }

    const move = findLegalMove(
      drag.cardIds[0],
      drag.fromPile,
      drag.fromIndex,
      dropTarget.pile,
      dropTarget.index
    );

    if (move) {
      executeMove(move);
    }
  }, [findLegalMove, executeMove]);

  const handleTap = useCallback((cardId: string, fromPile: 'waste' | 'tableau' | 'stock', fromIndex: number) => {
    if (fromPile === 'stock') {
      onDrawFromStock();
      return;
    }
    
    // If something is selected, try to move to tapped location
    const selectedCard = [...allCards.values()].find(c => isSelected(c.id));
    if (selectedCard && !isSelected(cardId)) {
      // Try to move selection to this pile
      if (fromPile === 'tableau') {
        const success = onMoveSelectionTo('tableau', fromIndex);
        if (success) return;
      }
    }
    
    // Otherwise, select/deselect the tapped card
    onSelectCard(cardId, fromPile, fromIndex);
  }, [allCards, isSelected, onDrawFromStock, onSelectCard, onMoveSelectionTo]);

  // Handle double-tap: auto-move to foundation if possible
  const handleDoubleTap = useCallback((cardId: string, fromPile: 'waste' | 'tableau', fromIndex: number) => {
    const card = allCards.get(cardId);
    if (!card) return;

    // For tableau, only allow double-tap on the top card
    if (fromPile === 'tableau') {
      const pile = gameState.tableau[fromIndex];
      if (pile.length === 0 || pile[pile.length - 1].id !== cardId) return;
    }

    // Find a valid foundation for this card
    for (let i = 0; i < gameState.foundations.length; i++) {
      if (canPlaceOnFoundation(card, gameState.foundations[i])) {
        const moveType = fromPile === 'waste' ? 'waste-to-foundation' : 'tableau-to-foundation';
        const move: Move = {
          type: moveType as Move['type'],
          from: { pile: fromPile, index: fromIndex },
          to: { pile: 'foundation', index: i },
          cardIds: [cardId],
        };
        executeMove(move);
        return;
      }
    }
  }, [allCards, gameState.tableau, gameState.foundations, executeMove]);

  const handleEmptyPileClick = useCallback((pileType: 'foundation' | 'tableau', pileIndex: number) => {
    // If something is selected, try to move it here
    const selectedCard = [...allCards.values()].find(c => isSelected(c.id));
    if (selectedCard) {
      onMoveSelectionTo(pileType, pileIndex);
    }
  }, [allCards, isSelected, onMoveSelectionTo]);

  const { drag, validTargets, handlers } = usePointer({
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onTap: handleTap,
    onDoubleTap: handleDoubleTap,
    getValidDropTargets,
  });

  const isDragging = useCallback((cardId: string) => {
    return drag?.cardIds.includes(cardId) ?? false;
  }, [drag]);

  // Get cards being dragged for overlay
  const draggedCards = useMemo(() => {
    if (!drag) return [];
    return drag.cardIds.map(id => allCards.get(id)).filter(Boolean) as CardType[];
  }, [drag, allCards]);

  // Check if a pile is a valid drop target
  const isValidTarget = useCallback((pileType: 'foundation' | 'tableau', pileIndex: number) => {
    return validTargets.some(t => t.pile === pileType && t.index === pileIndex);
  }, [validTargets]);

  return (
    <div 
      className="relative w-full h-full flex flex-col items-center p-2 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      onClick={(e) => {
        // Click on empty space clears selection
        if (e.target === e.currentTarget) {
          onClearSelection();
        }
      }}
    >
      {/* Top row: Stock, Waste, gap, Foundations */}
      <div className="flex justify-between w-full max-w-[460px] mb-4">
        <div className="flex gap-3">
          {/* Stock */}
          <Pile
            cards={gameState.stock}
            pileType="stock"
            pileIndex={0}
            onEmptyClick={onDrawFromStock}
            onPileClick={onDrawFromStock}
          />
          
          {/* Waste */}
          <Pile
            cards={gameState.waste}
            pileType="waste"
            pileIndex={0}
            isSelected={isSelected}
            isDragging={isDragging}
            onCardPointerDown={(e, cardId) => {
              handlers.onPointerDown(e, cardId, 'waste', 0);
            }}
            onCardPointerMove={handlers.onPointerMove}
            onCardPointerUp={handlers.onPointerUp}
            onCardPointerCancel={handlers.onPointerCancel}
          />
        </div>
        
        {/* Foundations */}
        <div className="flex gap-2">
          {gameState.foundations.map((foundation, index) => (
            <Pile
              key={`foundation-${index}`}
              cards={foundation}
              pileType="foundation"
              pileIndex={index}
              isValidTarget={isValidTarget('foundation', index)}
              onPileClick={() => handleEmptyPileClick('foundation', index)}
            />
          ))}
        </div>
      </div>
      
      {/* Tableau */}
      <div className="flex justify-center gap-2 w-full max-w-[460px]">
        {gameState.tableau.map((tableau, index) => (
          <Pile
            key={`tableau-${index}`}
            cards={tableau}
            pileType="tableau"
            pileIndex={index}
            isSelected={isSelected}
            isDragging={isDragging}
            isValidTarget={isValidTarget('tableau', index)}
            onCardPointerDown={(e, cardId) => {
              handlers.onPointerDown(e, cardId, 'tableau', index);
            }}
            onCardPointerMove={handlers.onPointerMove}
            onCardPointerUp={handlers.onPointerUp}
            onCardPointerCancel={handlers.onPointerCancel}
            onPileClick={() => handleEmptyPileClick('tableau', index)}
          />
        ))}
      </div>
      
      {/* Drag overlay */}
      <DragOverlay drag={drag} cards={draggedCards} />
    </div>
  );
}
