import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useSpring } from 'framer-motion';
import Lenis from 'lenis';
import { ArrowRight, CornerDownLeft, Search as SearchIcon } from 'lucide-react';
import { Runner } from './Dogs';
import { CoverImage, EASE } from './ui';
import { cn } from './NeoButton';
import { getRandomBook, searchBooks } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// ---------------------------------------------------------------------
// Theme (light / dark), shared through a tiny external store
// ---------------------------------------------------------------------
const themeListeners = new Set();
const readTheme = () => document.documentElement.dataset.theme || 'light';
export const setTheme = (t) => {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('booklog-theme', t); } catch { /* private mode */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#1F1110' : '#F3F3E9');
  themeListeners.forEach((l) => l());
};
export const useTheme = () => {
  const theme = useSyncExternalStore((l) => { themeListeners.add(l); return () => themeListeners.delete(l); }, readTheme);
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')];
};

// ---------------------------------------------------------------------
// Smooth scrolling (Lenis); scrolls to top on navigation
// ---------------------------------------------------------------------
let lenis = null;
export const scrollToTop = (immediate = true) => (lenis ? lenis.scrollTo(0, { immediate }) : window.scrollTo(0, 0));
export const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.6 }) : window.scrollTo({ top: y, behavior: 'smooth' }));

export const SmoothScroll = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    let raf;
    const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); lenis = null; };
  }, []);
  useEffect(() => { scrollToTop(true); }, [pathname]);
  return null;
};

// ---------------------------------------------------------------------
// Cursor: a dot that grows into a labelled disc over [data-cursor] targets
// ---------------------------------------------------------------------
export const Cursor = () => {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 500, damping: 40, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 500, damping: 40, mass: 0.4 });
  const [label, setLabel] = useState(null);
  const [link, setLink] = useState(false);
  const [down, setDown] = useState(false);
  const [enabled] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches);

  useEffect(() => {
    if (!enabled) return undefined;
    document.documentElement.classList.add('has-cursor');
    const move = (e) => {
      x.set(e.clientX);
      y.set(e.clientY);
      const t = e.target.closest?.('[data-cursor]');
      setLabel(t ? t.getAttribute('data-cursor') : null);
      setLink(!t && !!e.target.closest?.('a, button, [role="button"], label, summary'));
    };
    const d = () => setDown(true);
    const u = () => setDown(false);
    const leave = () => { x.set(-100); y.set(-100); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mousedown', d);
    window.addEventListener('mouseup', u);
    document.addEventListener('mouseleave', leave);
    return () => {
      document.documentElement.classList.remove('has-cursor');
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mousedown', d);
      window.removeEventListener('mouseup', u);
      document.removeEventListener('mouseleave', leave);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;
  const size = label ? 84 : link ? 36 : 8;
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[300] flex items-center justify-center rounded-full mix-blend-difference bg-white text-black"
      style={{ x: sx, y: sy, translateX: '-50%', translateY: '-50%' }}
      animate={{ width: size, height: size, scale: down ? 0.8 : 1 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      <AnimatePresence>
        {label && (
          <motion.span
            key={label}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            className="caps text-[10px] font-semibold"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ---------------------------------------------------------------------
// Intro: the mark draws, the wordmark rises, a counter runs, then a panel
// wipes across to reveal the site. Once per browser session.
// ---------------------------------------------------------------------
export const Intro = () => {
  const [show, setShow] = useState(() => {
    try { return !sessionStorage.getItem('booklog-intro'); } catch { return false; }
  });
  const [pct, setPct] = useState(0);
  useEffect(() => {
    if (!show) return undefined;
    try { sessionStorage.setItem('booklog-intro', '1'); } catch { /* ignore */ }
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 1600);
      setPct(Math.round(100 * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const done = setTimeout(() => setShow(false), 2000);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[400] bg-bg-base text-red overflow-hidden flex flex-col items-center justify-center"
          exit={{ y: '-100%' }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
        >
          <p className="font-display text-[clamp(5rem,22vw,20rem)]">{String(pct).padStart(2, '0')}%</p>
          <div className="relative w-[min(70vw,560px)] h-px bg-red/30 mt-4">
            <span className="absolute left-0 top-0 h-px bg-red" style={{ width: `${pct}%` }} />
            <span className="absolute -top-[46px] -translate-x-1/2" style={{ left: `${pct}%` }}><Runner className="w-20 text-red" /></span>
          </div>
          <p className="caps mt-6">Fetching your books…</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ---------------------------------------------------------------------
// Page transitions: content rises in; a thin progress line runs on top
// ---------------------------------------------------------------------
export const PageTransition = ({ children }) => {
  const { pathname } = useLocation();
  return (
    <>
      <motion.div
        key={`bar-${pathname}`}
        className="fixed left-0 top-0 h-[2px] bg-accent-red z-[250] origin-left"
        initial={{ scaleX: 0, opacity: 1 }}
        animate={{ scaleX: [0, 0.7, 1], opacity: [1, 1, 0] }}
        transition={{ duration: 0.9, times: [0, 0.6, 1], ease: EASE }}
        style={{ width: '100%' }}
      />
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE }}
        onAnimationComplete={(def) => {
          // A leftover transform would trap position:fixed children (cursor-follow previews)
          if (def && def.y === 0) document.querySelectorAll('[data-page]').forEach((el) => { el.style.transform = 'none'; });
        }}
        data-page
      >
        {children}
      </motion.div>
    </>
  );
};

// ---------------------------------------------------------------------
// Live clock ("Reading globally · IST 14:22")
// ---------------------------------------------------------------------
export const useClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
};

export const LiveClock = ({ className }) => {
  const now = useClock();
  const tz = useMemo(() => {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return (zone.split('/').pop() || '').replace(/_/g, ' ');
    } catch { return ''; }
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return (
    <span className={cn('tabular-nums', className)}>
      {tz} {hh}<span className="blink">:</span>{mm}
    </span>
  );
};

// ---------------------------------------------------------------------
// Command palette (⌘K / Ctrl+K / "/")
// ---------------------------------------------------------------------
export const openPalette = () => window.dispatchEvent(new Event('booklog:palette'));

export const CommandPalette = ({ links = [] }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState({ books: [], authors: [], genres: [] });
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const [, toggleTheme] = useTheme();
  const { currentUser } = useAuth();
  const input = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      const typing = /input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable;
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('booklog:palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('booklog:palette', onOpen); };
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => input.current?.focus());
      document.documentElement.classList.add('lenis-stopped');
    } else {
      setQ('');
      document.documentElement.classList.remove('lenis-stopped');
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) { setResults({ books: [], authors: [], genres: [] }); return undefined; }
    setLoading(true);
    const id = setTimeout(() => {
      searchBooks(q)
        .then((r) => setResults({ books: r.books.slice(0, 6), authors: r.authors.slice(0, 3), genres: r.genres.slice(0, 3) }))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 160);
    return () => clearTimeout(id);
  }, [q]);

  const surprise = useCallback(async () => {
    const b = await getRandomBook();
    navigate(`/book/${encodeURIComponent(b.title)}`);
  }, [navigate]);

  const items = useMemo(() => {
    const go = (path) => () => navigate(path);
    const actions = [
      { group: 'Actions', label: 'Surprise me with a random book', hint: 'Random', run: surprise },
      { group: 'Actions', label: 'Toggle light / dark mode', hint: 'Theme', run: toggleTheme },
      ...(q.trim() ? [{ group: 'Actions', label: `See all results for “${q.trim()}”`, hint: 'Search', run: go(`/search?q=${encodeURIComponent(q.trim())}`) }] : []),
    ];
    const pages = links.filter((l) => !l.auth || currentUser).map((l) => ({ group: 'Go to', label: l.name, hint: l.path, run: go(l.path) }));
    const filter = (arr) => (q.trim() ? arr.filter((a) => a.label.toLowerCase().includes(q.trim().toLowerCase()) || a.hint === 'Search') : arr);
    return [
      ...results.books.map((b) => ({ group: 'Books', label: b.title, hint: b.authors?.[0], book: b, run: go(`/book/${encodeURIComponent(b.title)}`) })),
      ...results.authors.map((a) => ({ group: 'Authors', label: a.name, hint: `${a.book_count} books`, run: go(`/author/${encodeURIComponent(a.name)}`) })),
      ...results.genres.map((g) => ({ group: 'Genres', label: g.name, hint: `${g.book_count} books`, run: go(`/explore?genre=${encodeURIComponent(g.name)}`) })),
      ...filter(actions),
      ...filter(pages),
    ];
  }, [results, links, q, navigate, surprise, toggleTheme, currentUser]);

  useEffect(() => { setActive(0); }, [items.length, q]);

  const run = (item) => { setOpen(false); item?.run(); };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); run(items[active]); }
  };
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  let lastGroup = null;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[350] bg-black/35 backdrop-blur-[8px] flex items-start justify-center pt-[12vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          data-lenis-prevent
        >
          <motion.div
            initial={{ y: -20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="w-full max-w-2xl bg-bg-base text-text-main rounded-[28px] border-2 border-red shadow-brutal-lg overflow-hidden"
            role="dialog"
            aria-label="Command palette"
          >
            <div className="flex items-center gap-3 px-5 border-b border-border">
              <SearchIcon className="w-4 h-4 text-text-muted" />
              <input
                ref={input}
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search books, authors, genres or jump anywhere…"
                className="flex-1 bg-transparent py-5 text-[16px] outline-none placeholder:text-text-muted"
              />
              {loading && <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-ping" />}
              <kbd className="label border border-border rounded px-1.5 py-0.5">esc</kbd>
            </div>
            <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-2">
              {items.length === 0 && <p className="label px-5 py-6">Nothing found.</p>}
              {items.map((item, i) => {
                const header = item.group !== lastGroup;
                lastGroup = item.group;
                return (
                  <React.Fragment key={`${item.group}-${item.label}-${i}`}>
                    {header && <p className="label px-5 pt-3 pb-1.5">{item.group}</p>}
                    <button
                      data-idx={i}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => run(item)}
                      className={cn('w-full flex items-center gap-3 px-5 py-2 text-left transition-colors', active === i && 'bg-text-main text-bg-base')}
                    >
                      {item.book ? (
                        <span className="w-7 h-10 rounded-[2px] overflow-hidden flex-shrink-0 bg-surface-white"><CoverImage book={item.book} eager /></span>
                      ) : (
                        <ArrowRight className={cn('w-3.5 h-3.5 flex-shrink-0', active === i ? 'text-bg-base' : 'text-text-muted')} />
                      )}
                      <span className="flex-1 min-w-0 truncate text-[14px]">{item.label}</span>
                      <span className={cn('text-[11px] truncate max-w-[40%]', active === i ? 'opacity-70' : 'text-text-muted')}>{item.hint}</span>
                      {active === i && <CornerDownLeft className="w-3.5 h-3.5 opacity-70" />}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
            <div className="flex items-center justify-between px-5 py-2.5 border-t border-border label">
              <span>↑ ↓ to move · ↵ to open</span>
              <span>Search runs on PostgreSQL pg_trgm</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
