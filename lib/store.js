/* small persistence shim: Claude artifacts expose window.storage,
   everywhere else falls back to localStorage */
export const store = {
  async get(key) {
    if (typeof window === "undefined") throw new Error("no window");
    if (window.storage) return window.storage.get(key);
    const v = window.localStorage.getItem(key);
    if (v === null) throw new Error("not set");
    return { value: v };
  },
  async set(key, value) {
    if (typeof window === "undefined") return;
    if (window.storage) return window.storage.set(key, value);
    window.localStorage.setItem(key, value);
  },
};
