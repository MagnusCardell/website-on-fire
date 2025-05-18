import { useState, useCallback } from 'react';
import { useFileSystem } from './useFileSystem';

export const useTerminal = () => {
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const { currentDirectory, getContent, changeDirectory, listDirectory, updateFile } = useFileSystem();
  
  // Common commands for prediction
  const commonCommands = [
    'ls', 'cat resume.txt', 'clear', 'pwd', 'cd projects', 'cd ~', 'cd docs', 
    'help', 'date', 'ls -la', 'cat projects/website.md', 'cat projects/inventory.md',
    'tmux', 'cd ..', 'echo Hello World', 'cat docs/README.md'
  ];

  // Add text to terminal output
  const addToOutput = useCallback((text: string) => {
    setTerminalOutput(prev => [...prev, ...(text.split('\n'))]);
  }, []);

  // Update command history index
  const updateHistoryIndex = useCallback((index: number) => {
    setHistoryIndex(index);
  }, []);

  // Execute command and return output
  const executeCommand = useCallback((commandLine: string): string | null => {
    // Add to command history
    setCommandHistory(prev => [...prev, commandLine]);
    setHistoryIndex(prev => prev + 1);
    
    // Parse command and arguments
    const args = commandLine.trim().split(/\s+/);
    const cmd = args[0].toLowerCase();
    
    switch(cmd) {
      case 'ls': {
        let dir = args[1] || currentDirectory;
        try {
          const items = listDirectory(dir);
          return items.join('  ');
        } catch (error) {
          return `ls: cannot access '${dir}': No such file or directory`;
        }
      }
      
      case 'cd': {
        const path = args[1] || '~';
        const success = changeDirectory(path);
        if (!success) {
          return `cd: no such directory: ${path}`;
        }
        return '';
      }
      
      case 'cat': {
        if (!args[1]) {
          return 'cat: missing file operand';
        }
        
        const filePath = args[1];
        const content = getContent(filePath);
        
        if (content && typeof content === 'string') {
          return content;
        } else {
          return `cat: ${filePath}: No such file or directory`;
        }
      }
      
      case 'pwd': {
        return currentDirectory === '~' ? '/home/user' : currentDirectory;
      }
      
      case 'echo': {
        return args.slice(1).join(' ');
      }
      
      case 'date': {
        return new Date().toString();
      }
      
      case 'clear': {
        setTerminalOutput([]);
        return null;
      }
      
      case 'help': {
        return `Available commands:
  ls [directory]    - List directory contents
  cd [directory]    - Change directory
  cat [file]        - Display file contents
  pwd               - Print working directory
  clear             - Clear terminal
  echo [text]       - Display text
  date              - Display current date
  help              - Display this help message
  vim [file]        - Edit a file (simplified)
  nano [file]       - Edit a file (simplified)
  tmux              - Terminal multiplexer commands`;
      }

      case 'vim':
      case 'nano': {
        if (!args[1]) {
          return `${cmd}: missing file operand`;
        }
        
        const filePath = args[1];
        const content = getContent(filePath);
        
        if (content !== null && typeof content === 'string') {
          return `[This is a simplified ${cmd} editor]\nFile '${filePath}' opened. Use 'save ${filePath}' to save changes.\n\n${content}`;
        } else {
          return `${cmd}: ${filePath}: New file`;
        }
      }

      case 'save': {
        if (!args[1]) {
          return 'save: missing file operand';
        }
        
        const filePath = args[1];
        const content = args.slice(2).join(' ');
        
        const success = updateFile(filePath, content);
        if (success) {
          return `File '${filePath}' saved.`;
        } else {
          return `save: could not save to '${filePath}'`;
        }
      }

      case 'tmux': {
        if (args[1] === 'split-window') {
          return 'Pane already split.';
        }
        return 'tmux session active with 2 panes.';
      }
      
      default: {
        if (cmd) {
          return `${cmd}: command not found`;
        }
        return '';
      }
    }
  }, [
    currentDirectory, 
    listDirectory, 
    changeDirectory, 
    getContent, 
    updateFile,
  ]);

  return {
    terminalOutput,
    addToOutput,
    executeCommand,
    commandHistory,
    historyIndex,
    updateHistoryIndex,
    commonCommands,
  };
};
