import {
  absolute, display, initialFiles, isDir, list, lookup, resolve, tree, write,
  type Dir, type Location,
} from './fileSystem';

// The terminal's logic, with no React in it. One state holds the files, the current
// folder, the variables and the aliases; every command reads and returns that state.

export interface ShellState {
  files: Dir;
  cwd: Location;
  env: Record<string, string>;
  aliases: Record<string, string>;
}

// What the screen shows. A line is plain text, or a prompt followed by what was typed.
// Nothing here is ever markup: the component prints `text` as text.
export type Line =
  | { kind: 'text'; text: string }
  | { kind: 'prompt'; dir: string; text: string };

export interface Session {
  shell: ShellState;
  output: Line[];
  history: string[];
}

export interface Result {
  state: ShellState;
  lines: string[];
  clear: boolean;
}

// Commands offered as ghost text before the visitor has a history of their own
export const SEED_COMMANDS = [
  'ls', 'cat resume.txt', 'clear', 'pwd', 'cd ~',
  'help', 'date', 'ls -la', 'cat projects/website.md',
  'tmux', 'cd ..', 'echo Hello World', 'cat docs/README.md',
];

const HELP = `Available commands:
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

export function initialState(): ShellState {
  return { files: initialFiles(), cwd: [], env: {}, aliases: {} };
}

export function welcome(now: Date): Line[] {
  return `Welcome to mcardell (GNU/Linux 5.15.0-56-generic x86_64)

 * Documentation:  https://github.com/MagnusCardell
 * About me:       https://www.linkedin.com/in/magnuscardell/
 * Resume:         Type 'cat resume.txt' to view resume

Last login: ${now.toLocaleDateString()} ${now.toLocaleTimeString()} from 192.168.1.100
`.split('\n').map((text) => ({ kind: 'text', text }));
}

export function startSession(now: Date): Session {
  return { shell: initialState(), output: welcome(now), history: [] };
}

// Runs one command (no `;`) and returns what it printed and the state after it
export function run(state: ShellState, commandLine: string): Result {
  const args = commandLine.trim().split(/\s+/);
  const cmd = args[0].toLowerCase();
  const say = (text: string, next: ShellState = state): Result => ({ state: next, lines: text.split('\n'), clear: false });
  const silent = (next: ShellState = state): Result => ({ state: next, lines: [], clear: false });
  const nodeAt = (path: string) => {
    const at = resolve(state.cwd, path);
    return { at, node: at ? lookup(state.files, at) : undefined };
  };

  switch (cmd) {
    case 'ls': {
      const target = args.slice(1).find((arg) => !arg.startsWith('-'));
      const { node } = nodeAt(target ?? '');
      if (node === undefined) return say(`ls: cannot access '${target}': No such file or directory`);
      return say(isDir(node) ? Object.keys(node).join('  ') : target!);
    }

    case 'cd': {
      const path = args[1] || '~';
      const { at, node } = nodeAt(path);
      if (!at || !isDir(node)) return say(`cd: no such directory: ${path}`);
      return silent({ ...state, cwd: at });
    }

    case 'cat': {
      if (!args[1]) return say('cat: missing file operand');
      const { node } = nodeAt(args[1]);
      return say(typeof node === 'string' && node ? node : `cat: ${args[1]}: No such file or directory`);
    }

    case 'pwd':
      return say(absolute(state.cwd));

    case 'export': {
      const [key, value] = args[1]?.split('=') ?? [];
      if (key && value) return silent({ ...state, env: { ...state.env, [key]: value } });
      return say('export: invalid format');
    }

    case 'echo': {
      const raw = args.slice(1).join(' ');
      return say(raw.replace(/\$([A-Z_]+)/gi, (_, key) => (Object.hasOwn(state.env, key) ? state.env[key] : '')));
    }

    case 'date':
      return say(new Date().toString());

    case 'clear':
      return { state, lines: [], clear: true };

    case 'help':
      return say(HELP);

    case 'vim':
    case 'nano': {
      if (!args[1]) return say(`${cmd}: missing file operand`);
      const { node } = nodeAt(args[1]);
      if (typeof node === 'string') {
        return say(`[This is a simplified ${cmd} editor]\nFile '${args[1]}' opened. Use 'save ${args[1]}' to save changes.\n\n${node}`);
      }
      return say(`${cmd}: ${args[1]}: New file`);
    }

    case 'save': {
      if (!args[1]) return say('save: missing file operand');
      const at = resolve(state.cwd, args[1]);
      const files = at ? write(state.files, at, args.slice(2).join(' ')) : null;
      if (!files) return say(`save: could not save to '${args[1]}'`);
      return say(`File '${args[1]}' saved.`, { ...state, files });
    }

    case 'tmux':
      return say(args[1] === 'split-window' ? 'Pane already split.' : 'tmux session active with 2 panes.');

    case 'whoami':
      return say('guest@mcardell');

    case 'nmap': {
      const typed = args.join(' ');
      if (typed === 'nmap -sS -p- localhost') return say('WARNING: You are not root');
      if (typed === 'nmap -sT -p- localhost') return say('Ports 80 and 443 open. Good job.');
      return say('Ports are open. Figure it out. ');
    }

    case 'tree': {
      const here = lookup(state.files, state.cwd);
      return { state, lines: ['.', ...(isDir(here) ? tree(here) : [])], clear: false };
    }

    case 'sudo':
      return say('You have no power here.');

    case 'alias': {
      const match = commandLine.trim().match(/^alias (\w+)=(['"])(.+)\2$/);
      if (!match) return say('alias: invalid format');
      const [, key, , value] = match;
      return say(`alias ${key}='${value}'`, { ...state, aliases: { ...state.aliases, [key]: value } });
    }

    default:
      return cmd ? say(`${cmd}: command not found`) : silent();
  }
}

// What happens when the visitor presses Enter: the typed line is echoed after the
// prompt, each `;` part runs in turn, and the line joins the history.
export function submit(session: Session, input: string, now: Date = new Date()): Session {
  if (!input.trim()) return session;

  let shell = session.shell;
  let output: Line[] = [...session.output, { kind: 'prompt', dir: display(shell.cwd), text: input }];

  for (const part of input.split(';')) {
    const typed = part.trim();
    if (!typed) continue;
    const name = typed.split(/\s+/)[0];
    const command = Object.hasOwn(shell.aliases, name) ? shell.aliases[name] + typed.slice(name.length) : typed;
    const result = run(shell, command);
    shell = result.state;
    // `clear` leaves the screen as a fresh login, as it always has here
    output = result.clear ? welcome(now) : [...output, ...result.lines.map((text): Line => ({ kind: 'text', text }))];
  }

  return { shell, output, history: [...session.history, input] };
}

// The ghost text after the cursor: a known command for the first word, a file or
// folder name after that. Always starts with what was typed, or is null.
export function suggest(session: Session, input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const args = trimmed.split(/\s+/);

  let candidate: string | undefined;
  if (args.length === 1) {
    candidate = [...SEED_COMMANDS, ...session.history].find((known) => known.startsWith(args[0]));
  } else {
    const last = args[args.length - 1];
    const slash = last.lastIndexOf('/');
    const folder = slash === -1 ? '' : last.slice(0, slash) || '/';
    const prefix = slash === -1 ? last : last.slice(slash + 1);
    const at = resolve(session.shell.cwd, folder);
    const name = (at ? list(session.shell.files, at) : null)?.find((entry) => entry.startsWith(prefix));
    if (name) candidate = `${args.slice(0, -1).join(' ')} ${slash === -1 ? '' : last.slice(0, slash + 1)}${name}`;
  }

  return candidate && candidate !== input && candidate.startsWith(input) ? candidate : null;
}

// Walking the history with the arrow keys. `position` is null while the visitor is
// typing a new line; ↑ steps back from the newest entry, ↓ steps forward and off the end.
export function recall(
  history: string[],
  position: number | null,
  direction: 'older' | 'newer',
): { position: number | null; value: string } | null {
  if (direction === 'older') {
    const next = (position ?? history.length) - 1;
    return next >= 0 ? { position: next, value: history[next] } : null;
  }
  if (position === null) return null;
  const next = position + 1;
  return next < history.length ? { position: next, value: history[next] } : { position: null, value: '' };
}
