import { useState, useRef, useEffect } from 'react';

interface SolitairelWindowProps {
  isMaximized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  position: { x: string; y: string };
  size: { width: string; height: string };
  onPositionUpdate: (x: string, y: string) => void;
}

const SolitaireWindow: React.FC<SolitairelWindowProps> = ({
  isMaximized,
  onClose,
  onMinimize,
  onMaximize,
  position,
  size,
  onPositionUpdate,
}) => {
  const solitaireWindowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Setup dragging functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !isMaximized && solitaireWindowRef.current) {
        const desktop = document.getElementById('root');
        if (!desktop) return;

        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        
        const maxX = desktop.clientWidth - solitaireWindowRef.current.offsetWidth;
        const maxY = desktop.clientHeight - solitaireWindowRef.current.offsetHeight;
        
        const boundedX = Math.max(0, Math.min(x, maxX));
        const boundedY = Math.max(48, Math.min(y, maxY)); // Account for top bar
        
        const xPercent = (boundedX / desktop.clientWidth) * 100;
        const yPercent = (boundedY / desktop.clientHeight) * 100;
        
        onPositionUpdate(`${xPercent}%`, `${yPercent}%`);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, isMaximized, onPositionUpdate]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (headerRef.current?.contains(e.target as Node) && !isMaximized) {
      setIsDragging(true);
      if (solitaireWindowRef.current) {
        const rect = solitaireWindowRef.current.getBoundingClientRect();
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  };

  return (
    <div
      ref={solitaireWindowRef}
      id="solitaire-window"
      className="absolute overflow-hidden shadow-lg rounded-lg window-transition window-appear"
      style={{
        width: size.width,
        height: size.height,
        left: position.x,
        top: position.y,
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div 
        ref={headerRef}
        className="bg-gray-800 h-8 flex items-center px-2 rounded-t-lg cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex space-x-2 mr-4">
          <button 
            className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" 
            onClick={onClose}
          />
          <button 
            className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 transition-colors" 
            onClick={onMinimize}
          />
          <button 
            className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 transition-colors" 
            onClick={onMaximize}
          />
        </div>
        <div className="text-center flex-1 text-sm font-medium select-none">
          Solitaire
        </div>
      </div>

      {/* Content */}
      <div className="w-full h-full bg-black/20">
        <iframe
          title="Solitaire minigame"
          src="/solitaire/?embed=1"
          className="w-full h-full border-0 rounded-b-xl"
          // allow pointer/touch inside iframe
          allow="fullscreen"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};

export default SolitaireWindow;
