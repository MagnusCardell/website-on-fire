import { useState, useEffect } from 'react';

const TopBar = () => {
  const [time, setTime] = useState<string>('');

  // Update clock every minute
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
      setTime(`${displayHours}:${displayMinutes} ${ampm}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 60000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-black bg-opacity-80 h-8 flex items-center justify-between px-4 z-10">
      <div className="flex items-center space-x-4">
      </div>
      <div className="flex items-center space-x-4">
        <span id="clock" className="text-sm">{time}</span>
      </div>
      <div className="flex items-center space-x-4">
        <span className="text-sm">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" 
            />
          </svg>
        </span>
      </div>
    </div>
  );
};

export default TopBar;
