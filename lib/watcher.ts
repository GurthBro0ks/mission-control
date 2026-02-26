import chokidar, { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import path from 'path';

const WATCH_DIR = '/home/slimy/ned-clawd';
const DEBOUNCE_MS = 500;

class FileWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
  }

  start() {
    if (this.watcher) return;

    this.watcher = chokidar.watch(
      [
        path.join(WATCH_DIR, '*.json'),
        path.join(WATCH_DIR, '*.md'),
        path.join(WATCH_DIR, 'tasks/*.json'),
        path.join(WATCH_DIR, 'memory/*.md'),
      ],
      {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 300,
          pollInterval: 100,
        },
      }
    );

    this.watcher.on('change', (filePath) => this.handleChange(filePath, 'change'));
    this.watcher.on('add', (filePath) => this.handleChange(filePath, 'add'));
    this.watcher.on('unlink', (filePath) => this.handleChange(filePath, 'delete'));

    console.log('[Watcher] Started watching', WATCH_DIR);
  }

  private handleChange(filePath: string, type: string) {
    // Debounce per file
    const existing = this.debounceTimers.get(filePath);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      const relativePath = filePath.replace(WATCH_DIR + '/', '');
      this.emit('change', { file: relativePath, type });
      this.debounceTimers.delete(filePath);
    }, DEBOUNCE_MS);

    this.debounceTimers.set(filePath, timer);
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.debounceTimers.forEach(t => clearTimeout(t));
    this.debounceTimers.clear();
  }
}

// Singleton
export const fileWatcher = new FileWatcher();
