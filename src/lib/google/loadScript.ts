const loaded = new Map<string, Promise<void>>();

/** Loads a third-party script once. */
export function loadScript(src: string): Promise<void> {
  let p = loaded.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        loaded.delete(src);
        reject(new Error(`Failed to load ${src}`));
      };
      document.head.appendChild(s);
    });
    loaded.set(src, p);
  }
  return p;
}
