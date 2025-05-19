import { useState, useCallback } from 'react';
import { useFileSystem } from './useFileSystem';

// Common commands for prediction
const mockHistory = [
    'ls', 'cat resume.txt', 'clear', 'pwd', 'cd ~', 
    'help', 'date', 'ls -la', 'cat projects/inventory.md',
    'tmux', 'cd ..', 'echo Hello World', 'cat docs/README.md'
];

export const useTerminal = () => {
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [commandHistory, setCommandHistory] = useState<string[]>(mockHistory);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const { currentDirectory, getContent, changeDirectory, listDirectory, updateFile } = useFileSystem();
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [aliases, setAliases] = useState<Record<string, string>>({});


  const getSuggestions = (
    input: string,
    history: string[],
    currentDirectory: string,
    listDirectory: (path?: string) => string[]
  ): string[] => {
    const trimmed = input.trim();
    const args = trimmed.split(/\s+/);
  
    if (args.length === 0) return [];
  
    const lastArg = args[args.length - 1];
    const isSingleWord = args.length === 1;
  
    if (isSingleWord) {
      return history.filter((cmd) => cmd.startsWith(lastArg));
    }
  
    // If not the first arg, assume path completion
    const base = args.slice(0, -1).join(" ");
    const slashIndex = lastArg.lastIndexOf("/");
    const dir = slashIndex === -1 ? "." : lastArg.slice(0, slashIndex);
    const prefix = slashIndex === -1 ? lastArg : lastArg.slice(slashIndex + 1);
  
    try {
      const contents = listDirectory(dir === "." ? currentDirectory : dir);
      return contents
        .filter((entry) => entry.startsWith(prefix))
        .map((entry) => `${base} ${dir === "." ? "" : dir + "/"}${entry}`);
    } catch {
      return [];
    }
  };

  // Add text to terminal output
  const addToOutput = useCallback((text: string | (() => string)) => {
    setTerminalOutput(prev => {
      const content = typeof text === 'function' ? text() : text;
      return [...prev, ...content.split('\n')];
    });
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
        const home = '/home/guest';
        const normalized = currentDirectory
          .replace(/^~(?=\/|$)/, home)
          .replace(/^\/~(?=\/|$)/, home); 
        return normalized;
      }
      
      case 'export': {
        const [key, value] = args[1]?.split('=') ?? [];
        if (key && value) {
          setEnvVars(prev => ({ ...prev, [key]: value }));
          return '';
        }
        return 'export: invalid format';
      }
      
      case 'echo': {
        const raw = args.slice(1).join(' ');
        const interpolated = raw.replace(/\$([A-Z_]+)/gi, (_, key) => envVars[key] || '');
        return interpolated;
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
        ls [dir]            - List directory contents
        cd [dir]            - Change directory
        cat [file]          - Display file contents
        pwd                 - Print working directory
        clear               - Clear terminal
        echo [text]         - Display text
        date                - Show current date/time
        whoami              - Show current user
        tree                - Display file tree
        vim [file]          - Edit file (simplified)
        nano [file]         - Edit file (simplified)
        save [file] [text]  - Save changes to a file
        export VAR=value    - Set environment variable
        alias name=command  - Alias support
        tmux                - Terminal multiplexer
        nmap [...]          - Port scanner
      
      Features:
        - Command history with ↑ / ↓
        - Command auto-completion with Tab / →
        - Alias and variable substitution
        - Command chaining with ;
      `;
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
      
      case 'whoami': {
        return "guest@mcardell"
      }

      case 'nmap': {
        if (commandLine === 'nmap -sS -p- localhost'){
          return 'WARNING: You are not root'
        } 
        else if(commandLine ==='nmap -sT -p- localhost'){
          return 'Ports 80 and 443 open. Good job.'
        }
        
        return 'Ports are open. Figure it out. '
      }

      case 'tree': {
        return `
.
├── resume.txt
├── docs
│   └── README.md
└── projects
    ├── website.md
    └── inventory.md
      `}

      case 'sudo': {
        return 'You have no power here.';
      }

      case 'alias': {
        const aliasMatch = commandLine.match(/^alias (\w+)=(['"])(.+)\2$/);
        if (aliasMatch) {
          const [, key, , value] = aliasMatch;
          setAliases(prev => ({ ...prev, [key]: value }));
          return `alias ${key}='${value}'`;
        }
        return 'export: invalid format';
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
    envVars,
    setEnvVars,
    setCommandHistory,
    commandHistory,
    aliases,
    setAliases
  ]);

  return {
    terminalOutput,
    addToOutput,
    executeCommand,
    commandHistory,
    historyIndex,
    updateHistoryIndex,
    aliases,
    listDirectory,
    getSuggestions
  };
};
