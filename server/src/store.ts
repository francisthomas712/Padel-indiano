import fs from 'node:fs';
import path from 'node:path';
import { LedgerEntry } from './ledger';

/**
 * Tiny JSON-file-backed store. For a friends-at-the-court app the write rate
 * is negligible (register once per device, one webhook per purchase), so a
 * debounced whole-file write beats adding SQLite. Swap later if ever needed.
 */
export class LedgerStore {
  private data = new Map<string, LedgerEntry>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(private readonly filePath: string) {
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as LedgerEntry[];
        parsed.forEach(entry => this.data.set(entry.rcUserId, entry));
      }
    } catch (error) {
      // Corrupt file: back it up and start clean rather than crash-loop
      try { fs.renameSync(this.filePath, `${this.filePath}.corrupt`); } catch { /* ignore */ }
      console.error('Ledger file corrupt, starting clean:', error);
    }
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  private flush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      try {
        const arr = Array.from(this.data.values());
        fs.writeFileSync(this.filePath, JSON.stringify(arr, null, 2));
      } catch (error) {
        console.error('Failed to persist ledger:', error);
      }
    }, 250);
  }

  get(rcUserId: string): LedgerEntry | null {
    return this.data.get(rcUserId) ?? null;
  }

  put(entry: LedgerEntry): void {
    this.data.set(entry.rcUserId, entry);
    this.flush();
  }
}
