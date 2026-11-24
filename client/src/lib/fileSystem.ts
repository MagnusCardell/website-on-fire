import { resumeText } from './resume';

// The pretend file system behind the terminal. Everything here is a pure function:
// the terminal keeps one copy of the files and one current folder, and asks these.

export type FsNode = string | Dir;
export interface Dir {
  [name: string]: FsNode;
}

// A place in the tree: the folder names below home. [] is home itself.
export type Location = string[];

export const HOME = '/home/guest';

export function initialFiles(): Dir {
  return {
    'resume.txt': resumeText(),
    projects: {
      'website.md':
        '# Personal Website\n\nAn interactive terminal-based resume website built with React and Express.',
      'emoji-whisperer.md':
        '# Emoji-Whisperer (2023)\n\nAn NPM package that processes text using RAKE and TF-IDF algorithms to map keyphrases with appropriate emojis using a custom scoring model.\n\nGitHub: https://github.com/MagnusCardell/emoji-whisperer',
      'uav-navigation.md':
        '# UAV Navigation (2020)\n\nA UAV path planning module built in ROS, integrating sensor inputs with static maps to track targets. The project evaluated A* and 3DVFH* algorithms in simulated embedded environments.\n\nPublication: DiVA urn:nbn:se:kth:diva-291229',
    },
    docs: {
      'README.md': '# Documentation\n\nThis directory contains documentation for my projects.',
    },
  };
}

export function isDir(node: FsNode | undefined): node is Dir {
  return typeof node === 'object' && node !== null;
}

// Where a typed path points, starting from the current folder. `~`, `/home/guest`,
// `.` and `..` all work; `..` stops at home. null means outside the visitor's home.
export function resolve(cwd: Location, path: string): Location | null {
  let at: Location;
  let rest: string;

  if (path === '~' || path.startsWith('~/')) {
    at = [];
    rest = path.slice(1);
  } else if (path === HOME || path.startsWith(HOME + '/')) {
    at = [];
    rest = path.slice(HOME.length);
  } else if (path.startsWith('/')) {
    return null;
  } else {
    at = [...cwd];
    rest = path;
  }

  for (const part of rest.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') at.pop();
    else at.push(part);
  }
  return at;
}

export function lookup(files: Dir, at: Location): FsNode | undefined {
  let node: FsNode = files;
  for (const name of at) {
    if (!isDir(node) || !Object.hasOwn(node, name)) return undefined;
    node = node[name];
  }
  return node;
}

// The names in a folder, or null when there is no folder there
export function list(files: Dir, at: Location): string[] | null {
  const node = lookup(files, at);
  return isDir(node) ? Object.keys(node) : null;
}

// A copy of the files with one file written. null when the folder it should go in
// does not exist, or the name already belongs to a folder.
export function write(files: Dir, at: Location, content: string): Dir | null {
  if (at.length === 0) return null;
  const [name, ...below] = at;
  const existing = Object.hasOwn(files, name) ? files[name] : undefined;

  if (below.length === 0) {
    if (isDir(existing)) return null;
    return { ...files, [name]: content };
  }
  if (!isDir(existing)) return null;
  const child = write(existing, below, content);
  return child ? { ...files, [name]: child } : null;
}

// `~/projects`, as the prompt shows it
export function display(at: Location): string {
  return ['~', ...at].join('/');
}

// `/home/guest/projects`, as pwd prints it
export function absolute(at: Location): string {
  return [HOME, ...at].join('/');
}

// The lines `tree` draws under the dot
export function tree(dir: Dir, indent = ''): string[] {
  const names = Object.keys(dir);
  return names.flatMap((name, i) => {
    const last = i === names.length - 1;
    const node = dir[name];
    const line = `${indent}${last ? '└── ' : '├── '}${name}`;
    return isDir(node) ? [line, ...tree(node, indent + (last ? '    ' : '│   '))] : [line];
  });
}
