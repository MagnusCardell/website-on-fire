import React from 'react';
import Terminal from './Terminal';

const TerminalPane: React.FC = () => {
  return (
    <div className="w-full md:w-1/2 h-full overflow-y-auto pr-1 md:border-r border-terminal-border">
      <Terminal />
    </div>
  );
};

export default TerminalPane;
