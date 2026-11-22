// Pull a small palette out of a cover image (covers.openlibrary.org sends
// CORS headers, so the canvas stays readable). Results are cached per URL.
const cache = new Map();

const hash = (s = '') => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
const fallback = (key) => {
  const h = Math.abs(hash(key)) % 360;
  return [`hsl(${h} 45% 42%)`, `hsl(${(h + 30) % 360} 30% 78%)`, `hsl(${(h + 200) % 360} 25% 22%)`];
};

export function coverPalette(url, count = 3) {
  if (!url) return Promise.resolve(fallback('none'));
  if (cache.has(url)) return cache.get(url);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        const w = (c.width = 24);
        const h = (c.height = 36);
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        // Bucket colours, prefer saturated and frequent ones
        const buckets = new Map();
        for (let i = 0; i < data.length; i += 4) {
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
          e.r += r; e.g += g; e.b += b; e.n += 1;
          buckets.set(key, e);
        }
        const colours = [...buckets.values()]
          .map((e) => {
            const r = e.r / e.n, g = e.g / e.n, b = e.b / e.n;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            return { r, g, b, n: e.n, sat: max === 0 ? 0 : (max - min) / max };
          })
          .sort((a, b) => b.n * (0.5 + b.sat) - a.n * (0.5 + a.sat));
        const picked = [];
        for (const col of colours) {
          if (picked.every((p2) => Math.abs(p2.r - col.r) + Math.abs(p2.g - col.g) + Math.abs(p2.b - col.b) > 90)) picked.push(col);
          if (picked.length === count) break;
        }
        const out = picked.map((col) => `rgb(${col.r | 0} ${col.g | 0} ${col.b | 0})`);
        resolve(out.length ? out.concat(fallback(url)).slice(0, count) : fallback(url));
      } catch {
        resolve(fallback(url));
      }
    };
    img.onerror = () => resolve(fallback(url));
    img.src = url.replace(/-L\.jpg$/, '-S.jpg');
  });
  cache.set(url, p);
  return p;
}
