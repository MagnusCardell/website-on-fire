import React, { useState, useRef, useEffect } from 'react';
import { useTerminal } from '@/lib/useTerminal';
import { display } from '@/lib/fileSystem';

// The oh-my-zsh style prompt, drawn the same way for past lines and the live one
const Prompt: React.FC<{ dir: string }> = ({ dir }) => (
  <>
    <span className="text-cyan-400">guest</span>
    <span className="text-white">@</span>
    <span className="text-yellow-400">mcardell</span>
    <span className="text-white"> </span>
    <span className="text-green-400">{dir}</span>
    <span className="text-white"> </span>
    <span className="text-cyan-400">→</span>
  </>
);

const Terminal: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const { session, enter, step, ghost } = useTerminal();
  const suggestion = ghost(inputValue);

  // Focus input on mount and when terminal is clicked
  useEffect(() => {
    inputRef.current?.focus();

    const handleClick = () => {
      inputRef.current?.focus();
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Scroll to bottom when terminal output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [session.output]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        enter(inputValue);
        setInputValue('');
      }
    }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const line = step(e.key === 'ArrowUp' ? 'older' : 'newer');
      if (line !== null) setInputValue(line);
    }
    else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestion) setInputValue(suggestion);
    }
    else if (e.key === 'ArrowRight' && inputValue.length === inputRef.current?.selectionStart && suggestion) {
      e.preventDefault();
      setInputValue(suggestion);
    }
  };

  return (
    <div id="terminal-pane" className="font-ubuntu-mono text-sm h-full flex flex-col">
      <div
        ref={outputRef}
        id="terminal-output"
        className="whitespace-pre-wrap h-full overflow-y-auto"
      >
        {/* Lines are printed as text, so nothing typed here can become markup */}
        {session.output.map((line, index) => (
          line.kind === 'prompt'
            ? <div key={index}><Prompt dir={line.dir} /> {line.text}</div>
            : <div key={index}>{line.text}</div>
        ))}
        <div className="flex items-center">
          <div className="flex items-center">
            <Prompt dir={display(session.shell.cwd)} />
            <span className="text-white">&nbsp;</span>
          </div>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              id="command-input"
              className="bg-transparent w-full outline-none border-none"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
            />
            {suggestion && (
              <div className="absolute top-0 left-0 text-gray-500 pointer-events-none">
                {inputValue}
                <span className="text-gray-500">{suggestion.slice(inputValue.length)}</span>
              </div>
            )}
            <span
              ref={cursorRef}
              className="absolute top-0 w-[0.6em] h-[1.2em] bg-white opacity-75 cursor-blink"
              style={{ left: `${inputValue.length * 0.6}em` }}
            ></span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Terminal;
