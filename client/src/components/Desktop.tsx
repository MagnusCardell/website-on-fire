import { useState, useEffect } from 'react';
import TopBar from './TopBar';
import Dock from './Dock';
import TerminalWindow from './ResumePane';

const Desktop = () => {
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [position, setPosition] = useState({ x: '5%', y: '10%' });
  const [size, setSize] = useState({ width: '90%', height: '85%' });

  // Toggle terminal visibility
  const toggleTerminal = () => {
    setIsTerminalOpen(!isTerminalOpen);
  };

  // Maximize/restore terminal window
  const toggleMaximize = () => {
    if (isTerminalMaximized) {
      setSize({ width: '90%', height: '85%' });
      setPosition({ x: '5%', y: '10%' });
    } else {
      setSize({ width: '100%', height: '100%' });
      setPosition({ x: '0', y: '0' });
    }
    setIsTerminalMaximized(!isTerminalMaximized);
  };

  // Handle terminal window position update when dragging
  const handlePositionUpdate = (x: string, y: string) => {
    setPosition({ x, y });
  };

  // Automatically open terminal on mount
  useEffect(() => {
    setIsTerminalOpen(true);
  }, []);

  return (
    <div className="h-screen flex flex-col font-ubuntu bg-ubuntu-desktop text-white overflow-hidden">
      <TopBar />
      
      <div className="flex-1 relative p-4 overflow-hidden">
        {/* Desktop Icons */}

        <div className="absolute top-4 left-4 flex flex-col items-center cursor-pointer"
        onClick={toggleTerminal}>
          <div className="w-12 h-12 bg-ubuntu-orange rounded-xl flex items-center justify-center mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-xs bg-opacity-70 px-2 py-1 rounded">Terminal</span>
        </div>
        
        {/* GitHub Icon */}
        <a 
          href="https://github.com/MagnusCardell" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="absolute top-4 left-24 flex flex-col items-center cursor-pointer"
        >
          <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </div>
          <span className="text-xs bg-opacity-70 px-2 py-1 rounded">GitHub</span>
        </a>
        
        {/* Terminal Window */}
        {isTerminalOpen && (
          <TerminalWindow 
            isMaximized={isTerminalMaximized}
            onClose={() => setIsTerminalOpen(false)}
            onMinimize={() => setIsTerminalOpen(false)}
            onMaximize={toggleMaximize}
            position={position}
            size={size}
            onPositionUpdate={handlePositionUpdate}
          />
        )}
      </div>
      
      <Dock onTerminalClick={toggleTerminal} />
    </div>
  );
};

export default Desktop;
