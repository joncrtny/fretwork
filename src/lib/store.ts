/* small persistence shim: Claude artifacts expose window.storage,
   everywhere else falls back to localStorage */
interface StoreWindow {
  storage?: { get(key: string): Promise<{ value: string }>; set(key: string, value: string): Promise<void> };
}

export const store = {
  async get(key: string): Promise<{ value: string }> {
    if (typeof window === "undefined") throw new Error("no window");
    const w = window as unknown as StoreWindow;
    if (w.storage) return w.storage.get(key);
    const v = window.localStorage.getItem(key);
    if (v === null) throw new Error("not set");
    return { value: v };
  },
  async set(key: string, value: string): Promise<void> {
    if (typeof window === "undefined") return;
    const w = window as unknown as StoreWindow;
    if (w.storage) return w.storage.set(key, value);
    window.localStorage.setItem(key, value);
  },
};
