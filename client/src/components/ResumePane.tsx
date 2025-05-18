import { useState, useRef, useEffect } from 'react';
import Terminal from './Terminal';
import { useTmux } from '@/lib/useTmux';

interface TerminalWindowProps {
  isMaximized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  position: { x: string; y: string };
  size: { width: string; height: string };
  onPositionUpdate: (x: string, y: string) => void;
}

const TerminalWindow: React.FC<TerminalWindowProps> = ({
  isMaximized,
  onClose,
  onMinimize,
  onMaximize,
  position,
  size,
  onPositionUpdate,
}) => {
  const terminalWindowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const { activePane, togglePane, panes } = useTmux();

  // Setup dragging functionality
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !isMaximized && terminalWindowRef.current) {
        const desktop = document.getElementById('root');
        if (!desktop) return;

        const x = e.clientX - dragOffset.x;
        const y = e.clientY - dragOffset.y;
        
        const maxX = desktop.clientWidth - terminalWindowRef.current.offsetWidth;
        const maxY = desktop.clientHeight - terminalWindowRef.current.offsetHeight;
        
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
      if (terminalWindowRef.current) {
        const rect = terminalWindowRef.current.getBoundingClientRect();
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    }
  };

  return (
    <div
      ref={terminalWindowRef}
      id="terminal-window"
      className="absolute overflow-hidden shadow-lg rounded-lg window-transition window-appear"
      style={{
        width: size.width,
        height: size.height,
        left: position.x,
        top: position.y,
        zIndex: 50,
      }}
    >
      {/* Terminal Header */}
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
          guest@mcardell: ~/
        </div>
      </div>

      {/* Terminal Content */}
      <div className="bg-ubuntu-purple h-[calc(100%-32px)] p-2 rounded-b-lg flex flex-col">

        {/* Tmux Panes */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Display appropriate pane content based on active pane */}
          {panes.map((pane, index) => (
            <div 
              key={index}
              className={`${
                index === 0 
                  ? "w-full md:w-1/2 h-full overflow-y-auto pr-0 md:pr-1 md:border-r border-terminal-border" 
                  : "w-full md:w-1/2 h-full overflow-y-auto pl-0 md:pl-1"
              } ${activePane === index ? "" : "hidden md:block"}`}
            >
              {index === 0 ? (
                <Terminal />
              ) : (
                <div className="font-ubuntu-mono text-sm overflow-y-auto">
                  
                  {/* LinkedIn-style Profile */}
                  <div className="bg-gray-900 rounded-lg p-4 mb-4">
                    <div className="flex items-center text-blue-400 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                    </svg>
                    <a 
                      href="https://www.linkedin.com/in/magnuscardell/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      LinkedIn Profile
                    </a>
                    
                  </div>

                    <div className="flex items-start mb-4">
                    <img 
                        src="https://media.licdn.com/dms/image/v2/C4E03AQF3qak-b7q4tQ/profile-displayphoto-shrink_800_800/profile-displayphoto-shrink_800_800/0/1654271233040?e=1752710400&v=beta&t=TIxeJ-HKIWEC-_EuyoSjxRC_WAcrZHWGjaJrTC3jm78" 
                        alt="Magnus Cardell"
                        className="w-16 h-16 rounded-full object-cover mr-3 border-2 border-blue-700"
                        onError={(e) => {
                          // Fallback to initials if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = "w-16 h-16 rounded-full bg-blue-700 text-white flex items-center justify-center text-xl font-bold mr-3";
                            fallback.innerText = "MC";
                            parent.insertBefore(fallback, target);
                          }
                        }}
                      />
                      <div>
                        <h2 className="text-xl font-bold text-white">Magnus Cardell</h2>
                        <p className="text-blue-400">Software Developer @ Netlight Consulting</p>
                        <p className="text-gray-400 text-sm">Stockholm, Sweden</p>
                      </div>
                    </div>
                    
                    <div className="text-gray-300 mb-4">
                      Software architect with expertise in system reliability, cloud architecture, and software engineering.
                    </div>
                    
                    <div className="border-t border-gray-700 pt-3 mt-3">
                      <h3 className="text-white font-semibold mb-2">Experience</h3>
                      <div className="mb-3">
                        <div className="flex">
                          <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center mr-2">N</div>
                          <div>
                            <p className="text-white font-medium">Netlight Consulting</p>
                            <p className="text-gray-400 text-xs">Software Architect · 2025-Present</p>
                            <p className="text-gray-400 text-xs">Senior Software Engineer · 2020-2024</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="flex">
                          <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center mr-2">H</div>
                          <div>
                            <p className="text-white font-medium">Handelsbanken Capital Markets</p>
                            <p className="text-gray-400 text-xs">Software Engineer · 2018-2020</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="flex">
                          <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center mr-2">L</div>
                          <div>
                            <p className="text-white font-medium">Lux Science Inc.</p>
                            <p className="text-gray-400 text-xs">Software Developer · 2017-2018</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-700 pt-3 mt-3">
                      <h3 className="text-white font-semibold mb-2">Education</h3>
                      <div className="flex">
                        <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center mr-2">S</div>
                        <div>
                          <p className="text-white font-medium">St. Olaf College</p>
                          <p className="text-gray-400 text-xs">Bachelor of Arts, Computer Science, Music · 2014-2018</p>
                          <p className="text-gray-400 text-xs">Awarded Christiansen Scholarship - highest merit based music scholarship</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-700 pt-3 mt-3">
                      <h3 className="text-white font-semibold mb-2">Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">C#</span>
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">Python</span>
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">JavaScript/TypeScript</span>
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">Azure</span>
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">AWS</span>
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">Kubernetes</span>
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">Docker</span>
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">Terraform</span>
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">SQL Server</span>
                        <span className="px-2 py-1 bg-gray-800 text-gray-300 text-xs rounded">Cosmos DB</span>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-700 pt-3 mt-3">
                      <h3 className="text-white font-semibold mb-2">Featured Projects</h3>
                      <a 
                        href="https://github.com/MagnusCardell/emoji-whisperer" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <div className="mb-2">
                          <p className="text-white font-medium">Emoji-Whisperer (2023)</p>
                          <p className="text-gray-400 text-sm">An NPM package processing text using RAKE and TF-IDF to map keyphrases with emojis</p>
                        </div>
                      </a>
                      <a
                        href="https://www.diva-portal.org/smash/record.jsf?pid=diva2%3A1534501&dswid=-5796" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <div>
                          <p className="text-white font-medium">UAV Navigation (2020)</p>
                          <p className="text-gray-400 text-sm">UAV path planning module integrating sensor inputs with static maps</p>
                        </div>
                      </a>
                    </div>
                    
                    <div className="mt-4 pt-2 border-t border-gray-700">
                      <p className="text-xs text-gray-500">Contact: cardell.magnus[at]gmail.com </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile Pane Switcher (only visible on small screens) */}
        <div className="md:hidden flex justify-center mt-2 border-t border-terminal-border pt-2">
          <button 
            className={`px-3 py-1 text-xs rounded ${activePane === 0 ? 'bg-ubuntu-orange' : 'bg-gray-700'} mr-2`}
            onClick={() => togglePane(0)}
          >
            Terminal
          </button>
          <button 
            className={`px-3 py-1 text-xs rounded ${activePane === 1 ? 'bg-ubuntu-orange' : 'bg-gray-700'}`}
            onClick={() => togglePane(1)}
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
};

export default TerminalWindow;
