import { MMKV } from 'react-native-mmkv';

/**
 * localStorage shim over MMKV so the shared core modules (localStorage.ts,
 * groups.ts — copied verbatim from the web app) run unchanged in React
 * Native. MMKV is synchronous like localStorage, unlike AsyncStorage.
 */
const mmkv = new MMKV();

const globalScope = globalThis as unknown as Record<string, unknown>;

if (!globalScope.localStorage) {
  globalScope.localStorage = {
    getItem: (key: string): string | null => mmkv.getString(key) ?? null,
    setItem: (key: string, value: string): void => {
      mmkv.set(key, value);
    },
    removeItem: (key: string): void => {
      mmkv.delete(key);
    },
    clear: (): void => {
      mmkv.clearAll();
    },
    key: (index: number): string | null => mmkv.getAllKeys()[index] ?? null,
    get length(): number {
      return mmkv.getAllKeys().length;
    }
  };
}

/** Small typed helpers for app-specific keys. */
export const storage = {
  getString: (key: string): string | null => mmkv.getString(key) ?? null,
  setString: (key: string, value: string): void => {
    mmkv.set(key, value);
  },
  delete: (key: string): void => {
    mmkv.delete(key);
  }
};
