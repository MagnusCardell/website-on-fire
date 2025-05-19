import React, { useState, useRef, useEffect } from 'react';
import { useTerminal } from '@/lib/useTerminal';
import { useFileSystem } from '@/lib/useFileSystem';

const Terminal: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const { executeCommand, commandHistory, historyIndex, updateHistoryIndex, terminalOutput, addToOutput, aliases, getSuggestions, listDirectory } = useTerminal();
  const { currentDirectory } = useFileSystem();
  const getPromptLine = (cmd: string) =>
    `%F{cyan}guest%f%F{white}@%f%F{yellow}mcardell%f %F{green}${currentDirectory}%f %F{cyan}→%f ${cmd}`;
  
  // command prediction logic w/ history + files in directory
  useEffect(() => {
    if (inputValue.trim()) {
      const candidates = getSuggestions(
        inputValue,
        commandHistory,
        currentDirectory,
        listDirectory
      );
      setSuggestion(candidates[0] || null);
    } else {
      setSuggestion(null);
    }
  }, [inputValue, commandHistory, currentDirectory, listDirectory]);

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
  }, [terminalOutput]);

  // Initialize with welcome message
  useEffect(() => {
    if (terminalOutput.length === 0) {
      addToOutput(`Welcome to mcardell (GNU/Linux 5.15.0-56-generic x86_64)

 * Documentation:  https://github.com/MagnusCardell
 * About me:       https://www.linkedin.com/in/magnuscardell/
 * Resume:         Type 'cat resume.txt' to view resume

Last login: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} from 192.168.1.100
`);
    }
        
  }, [addToOutput, terminalOutput.length]);

  // // Command prediction logic
  // useEffect(() => {
  //   if (inputValue.trim()) {
  //     const possibleCommand = commandHistory.find(cmd => cmd.startsWith(inputValue));
  //     if (possibleCommand) {
  //       setSuggestion(possibleCommand);
  //     } else {
  //       setSuggestion(null);
  //     }
  //   } else {
  //     setSuggestion(null);
  //   }
  // }, [inputValue, commandHistory]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      if (inputValue.trim()) {
        // Add command to output with prompt and fancy oh-my-zsh style
        addToOutput(getPromptLine(inputValue));

        // Execute the command and get result. Handle chaining if present
        inputValue.split(';').forEach(cmd => {
          const command = aliases[cmd.trim().split(' ')[0]] || cmd;
          const result = executeCommand(command.trim());
          // Add result to output if not null
          if (result !== null) {
            addToOutput(result);
          }
        });
        
        // Clear input and suggestion
        setInputValue('');
        setSuggestion(null);
      }
    } 
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        updateHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      }
    } 
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        updateHistoryIndex(newIndex);
        setInputValue(commandHistory[newIndex]);
      } else {
        updateHistoryIndex(commandHistory.length);
        setInputValue('');
      }
    } 
    else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestion) {
        setInputValue(suggestion);
      }
    }
    else if (e.key === 'ArrowRight' && inputValue.length === inputRef.current?.selectionStart && suggestion) {
      e.preventDefault();
      setInputValue(suggestion);
    }
  };

  // Terminal prompt with oh-my-zsh style
  const renderPrompt = () => (
    <div className="flex items-center">
      <span className="text-cyan-400">guest</span>
      <span className="text-white">@</span>
      <span className="text-yellow-400">mcardell</span>
      <span className="text-white"> </span>
      <span className="text-green-400">{currentDirectory}</span>
      <span className="text-white"> </span>
      <span className="text-cyan-400">→</span>
      <span className="text-white">&nbsp;</span>
    </div>
  );

  return (
    <div id="terminal-pane" className="font-ubuntu-mono text-sm h-full flex flex-col">
      <div 
        ref={outputRef} 
        id="terminal-output" 
        className="whitespace-pre-wrap h-full overflow-y-auto"
      >
        {terminalOutput.map((line, index) => {
          // Handle oh-my-zsh style color formatting
          if (line.includes('%F{')) {
            const formattedLine = line
              .replace(/%F{cyan}([^%]*)%f/g, '<span class="text-cyan-400">$1</span>')
              .replace(/%F{white}([^%]*)%f/g, '<span class="text-white">$1</span>')
              .replace(/%F{yellow}([^%]*)%f/g, '<span class="text-yellow-400">$1</span>')
              .replace(/%F{green}([^%]*)%f/g, '<span class="text-green-400">$1</span>');
            
            return <div key={index} dangerouslySetInnerHTML={{ __html: formattedLine }} />;
          }
          return <div key={index}>{line}</div>;
        })}
        <div className="flex items-center">
          {renderPrompt()}
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
            {suggestion && suggestion !== inputValue && (
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
