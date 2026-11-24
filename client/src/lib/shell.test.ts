import { describe, expect, test } from 'bun:test';
import { absolute, display, initialFiles, isDir, lookup, resolve, type Dir } from './fileSystem';
import { SEED_COMMANDS, recall, run, startSession, submit, suggest, type Line, type Session } from './shell';

const NOW = new Date(2026, 10, 24, 12, 0, 0);

function type(session: Session, ...inputs: string[]): Session {
  return inputs.reduce((s, input) => submit(s, input, NOW), session);
}

// The text lines printed by the last thing typed
function lastOutput(session: Session): string[] {
  const from = session.output.findLastIndex((line) => line.kind === 'prompt');
  return session.output.slice(from + 1).map((line) => line.text);
}

function lastPrompt(session: Session): Extract<Line, { kind: 'prompt' }> {
  return session.output.findLast((line) => line.kind === 'prompt') as Extract<Line, { kind: 'prompt' }>;
}

// Every folder in the tree, as the folder names below home
function folders(dir: Dir, at: string[] = []): string[][] {
  return [at, ...Object.entries(dir).flatMap(([name, node]) => (isDir(node) ? folders(node, [...at, name]) : []))];
}

function files(dir: Dir, at: string[] = []): string[][] {
  return Object.entries(dir).flatMap(([name, node]) => (isDir(node) ? files(node, [...at, name]) : [[...at, name]]));
}

describe('one place at a time', () => {
  test('the prompt follows cd, in and out of every folder', () => {
    for (const folder of folders(initialFiles())) {
      const path = display(folder);
      const inside = type(startSession(NOW), `cd ${path}`, 'pwd');
      expect(lastPrompt(inside).dir).toBe(path);
      expect(lastOutput(inside)).toEqual([absolute(folder)]);
    }
  });

  test('cd .. returns to home and stops there', () => {
    const s = type(startSession(NOW), 'cd projects', 'cd ..', 'cd ..', 'pwd');
    expect(lastPrompt(s).dir).toBe('~');
    expect(lastOutput(s)).toEqual(['/home/guest']);
  });

  test('the prompt line shows where the command was typed, not where it led', () => {
    const s = type(startSession(NOW), 'cd projects');
    expect(lastPrompt(s).dir).toBe('~');
    expect(lastPrompt(type(s, 'ls')).dir).toBe('~/projects');
  });

  test('ls with no argument lists the folder you are in, in every folder (the bug this guards)', () => {
    const all = initialFiles();
    for (const folder of folders(all)) {
      const s = type(startSession(NOW), `cd ${display(folder)}`, 'ls');
      expect(lastOutput(s)).toEqual([Object.keys(lookup(all, folder) as Dir).join('  ')]);
    }
  });

  test('ls takes a folder, a file, flags, and says so when nothing is there', () => {
    const s = startSession(NOW);
    expect(lastOutput(type(s, 'ls projects'))).toEqual(['website.md  emoji-whisperer.md  uav-navigation.md']);
    expect(lastOutput(type(s, 'ls -la'))).toEqual(['resume.txt  projects  docs']);
    expect(lastOutput(type(s, 'ls resume.txt'))).toEqual(['resume.txt']);
    expect(lastOutput(type(s, 'ls nowhere'))).toEqual(["ls: cannot access 'nowhere': No such file or directory"]);
  });

  test('paths work from anywhere: relative, ~, absolute, dots', () => {
    const s = type(startSession(NOW), 'cd projects');
    for (const path of ['website.md', './website.md', '~/projects/website.md', '/home/guest/projects/website.md', '../projects/website.md']) {
      expect(lastOutput(type(s, `cat ${path}`))[0]).toBe('# Personal Website');
    }
    expect(lastOutput(type(s, 'cat ../resume.txt'))[1]).toContain('MAGNUS CARDELL');
    expect(lastOutput(type(s, 'cat /etc/passwd'))).toEqual(['cat: /etc/passwd: No such file or directory']);
    expect(lastOutput(type(s, 'cd /'))).toEqual(['cd: no such directory: /']);
  });

  test('names that are not files are not found', () => {
    expect(resolve([], '/')).toBeNull();
    for (const name of ['constructor', '__proto__', 'toString']) {
      expect(lookup(initialFiles(), [name])).toBeUndefined();
      expect(lastOutput(type(startSession(NOW), `cat ${name}`))).toEqual([`cat: ${name}: No such file or directory`]);
    }
  });
});

describe('tree and suggestions name only what exists', () => {
  test('tree prints every file and folder, and nothing else', () => {
    const all = initialFiles();
    const printed = lastOutput(type(startSession(NOW), 'tree'));
    expect(printed[0]).toBe('.');
    const names = printed.slice(1).map((line) => line.replace(/^[│├└─ ]+/, ''));
    const expected = [...folders(all).slice(1), ...files(all)].map((at) => at[at.length - 1]);
    expect([...names].sort()).toEqual([...expected].sort());
  });

  test('tree starts from the folder you are in', () => {
    expect(lastOutput(type(startSession(NOW), 'cd docs', 'tree'))).toEqual(['.', '└── README.md']);
  });

  test('every seed command runs without an error (the bug this guards)', () => {
    for (const command of SEED_COMMANDS) {
      const printed = lastOutput(type(startSession(NOW), command)).join('\n');
      expect({ command, failed: /No such file|not found|cannot access|no such directory/.test(printed) })
        .toEqual({ command, failed: false });
    }
  });

  test('ghost text completes a command, then a path from the current folder', () => {
    const home = startSession(NOW);
    expect(suggest(home, 'c')).toBe('cat resume.txt');
    expect(suggest(home, 'cat pro')).toBe('cat projects');
    expect(suggest(home, 'cat projects/u')).toBe('cat projects/uav-navigation.md');
    expect(suggest(type(home, 'cd projects'), 'cat w')).toBe('cat website.md');
    expect(suggest(home, 'cat w')).toBeNull();
    expect(suggest(home, '')).toBeNull();
  });

  test('ghost text always continues what was typed', () => {
    const home = type(startSession(NOW), 'echo one', 'whoami');
    for (const input of ['c', 'ca', 'cat ', 'cat r', 'ls d', 'e', 'w', 'cat  r', 'cat /', 'x']) {
      const ghost = suggest(home, input);
      if (ghost !== null) expect(ghost.startsWith(input)).toBe(true);
    }
  });
});

describe('typed text stays text', () => {
  test('markup typed into echo comes back as the same characters', () => {
    const typed = 'echo %F{cyan}<b id=inj>bold</b>%f <img src=x onerror=alert(1)>';
    const s = type(startSession(NOW), typed);
    expect(lastPrompt(s).text).toBe(typed);
    expect(lastOutput(s)).toEqual(['%F{cyan}<b id=inj>bold</b>%f <img src=x onerror=alert(1)>']);
  });

  test('every line on screen is plain text or a prompt', () => {
    const s = type(startSession(NOW), 'help', 'cat resume.txt', 'echo <i>x</i>');
    for (const line of s.output) {
      expect(['text', 'prompt']).toContain(line.kind);
      expect(typeof line.text).toBe('string');
    }
  });
});

describe('history', () => {
  test('↑ recalls what was typed last, and nothing that was not typed', () => {
    const fresh = startSession(NOW);
    expect(fresh.history).toEqual([]);
    expect(recall(fresh.history, null, 'older')).toBeNull();

    const s = type(fresh, 'whoami', 'echo a; echo b');
    expect(s.history).toEqual(['whoami', 'echo a; echo b']);
    const one = recall(s.history, null, 'older')!;
    expect(one.value).toBe('echo a; echo b');
    const two = recall(s.history, one.position, 'older')!;
    expect(two.value).toBe('whoami');
    expect(recall(s.history, two.position, 'older')).toBeNull();
  });

  test('↓ walks forward and ends on an empty line', () => {
    const history = ['a', 'b'];
    expect(recall(history, null, 'newer')).toBeNull();
    expect(recall(history, 0, 'newer')).toEqual({ position: 1, value: 'b' });
    expect(recall(history, 1, 'newer')).toEqual({ position: null, value: '' });
  });

  test('an empty line is not run and not remembered', () => {
    const fresh = startSession(NOW);
    expect(submit(fresh, '   ', NOW)).toBe(fresh);
  });
});

describe('every command still answers', () => {
  const home = startSession(NOW);
  const answer = (...inputs: string[]) => lastOutput(type(home, ...inputs));

  test('cat, vim and nano', () => {
    expect(answer('cat')).toEqual(['cat: missing file operand']);
    expect(answer('cat docs')).toEqual(['cat: docs: No such file or directory']);
    expect(answer('cat docs/README.md')[0]).toBe('# Documentation');
    expect(answer('nano docs/README.md').slice(0, 2)).toEqual([
      '[This is a simplified nano editor]',
      "File 'docs/README.md' opened. Use 'save docs/README.md' to save changes.",
    ]);
    expect(answer('vim new.txt')).toEqual(['vim: new.txt: New file']);
    expect(answer('vim')).toEqual(['vim: missing file operand']);
  });

  test('save writes where the path says, and only there', () => {
    const s = type(home, 'save projects/notes.md hello there', 'cat projects/notes.md');
    expect(lastOutput(s)).toEqual(['hello there']);
    expect(lastOutput(type(s, 'ls'))).toEqual(['resume.txt  projects  docs']);
    expect(answer('save')).toEqual(['save: missing file operand']);
    expect(answer('save nowhere/x.txt hi')).toEqual(["save: could not save to 'nowhere/x.txt'"]);
    expect(answer('save projects hi')).toEqual(["save: could not save to 'projects'"]);
    expect(lookup(home.shell.files, ['projects', 'notes.md'])).toBeUndefined();
  });

  test('echo, export and variables', () => {
    expect(answer('echo Hello World')).toEqual(['Hello World']);
    expect(answer('export NAME=mom', 'echo hi $NAME')).toEqual(['hi mom']);
    expect(answer('echo $UNSET $constructor.')).toEqual([' .']);
    expect(answer('export broken')).toEqual(['export: invalid format']);
  });

  test('alias runs its command, keeps the arguments, and names itself in its error', () => {
    expect(answer("alias ll='ls -la'")).toEqual(["alias ll='ls -la'"]);
    expect(answer("alias ll='ls -la'", 'll projects')).toEqual(['website.md  emoji-whisperer.md  uav-navigation.md']);
    expect(answer('alias x')).toEqual(['alias: invalid format']);
  });

  test('chaining with ; runs each part in order', () => {
    expect(answer('cd projects; pwd; cd ..; pwd')).toEqual(['/home/guest/projects', '/home/guest']);
  });

  test('clear leaves a fresh login and keeps the folder', () => {
    const s = type(home, 'cd docs', 'clear');
    expect(s.output[0].text).toStartWith('Welcome to mcardell');
    expect(s.output.some((line) => line.kind === 'prompt')).toBe(false);
    expect(lastPrompt(type(s, 'pwd')).dir).toBe('~/docs');
  });

  test('the small ones', () => {
    expect(answer('pwd')).toEqual(['/home/guest']);
    expect(answer('whoami')).toEqual(['guest@mcardell']);
    expect(answer('sudo rm -rf /')).toEqual(['You have no power here.']);
    expect(answer('tmux')).toEqual(['tmux session active with 2 panes.']);
    expect(answer('tmux split-window')).toEqual(['Pane already split.']);
    expect(answer('nmap -sS -p- localhost')).toEqual(['WARNING: You are not root']);
    expect(answer('nmap -sT -p- localhost')).toEqual(['Ports 80 and 443 open. Good job.']);
    expect(answer('nmap example.com')).toEqual(['Ports are open. Figure it out. ']);
    expect(answer('LS')).toEqual(['resume.txt  projects  docs']);
    expect(answer('frobnicate')).toEqual(['frobnicate: command not found']);
    expect(Number.isNaN(Date.parse(answer('date')[0]))).toBe(false);
  });

  test('help lists every command it has', () => {
    const help = answer('help').join('\n');
    for (const name of ['ls', 'cd', 'cat', 'pwd', 'clear', 'echo', 'date', 'whoami', 'tree', 'vim', 'nano', 'save', 'export', 'alias', 'tmux', 'nmap']) {
      expect(help).toContain(name);
      expect(run(home.shell, name).lines.join('\n')).not.toContain('command not found');
    }
  });
});
