import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Bookmark, ChevronDown, ChevronUp, Heart, Link2, Lock, MessageCircle, Send, Sparkles, Trash2, X } from 'lucide-react';
import { cn } from '../components/NeoButton';
import { Avatar, CoverImage, EASE, timeAgo } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { coverPalette } from '../utils/colors';
import { deleteTake, getGenreIndex, getReels, likeTake, postTake, setShelf } from '../services/api';

const VIBES = {
  fun_fact: ['💡', 'Fun fact'],
  must_read: ['🔥', 'Must read'],
  cried: ['😭', 'Made me cry'],
  mind_blown: ['🤯', 'Mind-blown'],
  comfort: ['☕', 'Comfort read'],
  quote: ['❝', 'Quote'],
  slow_start: ['🐢', 'Slow start'],
  overrated: ['🙄', 'Overrated'],
};

const YEAR = new Date().getFullYear();

/** Little facts generated from the catalogue data, cycled on each reel. */
const factsFor = (b) => {
  const f = [];
  if (b.page_count) {
    const mins = Math.round((b.page_count / 45) * 60);
    f.push(`About ${Math.floor(mins / 60)}h ${mins % 60}m to read at 45 pages an hour.`);
    if (b.page_count > 635) f.push(`Longer than Moby-Dick by ${b.page_count - 635} pages.`);
    else f.push(`${Math.round((b.page_count / 635) * 100)}% the length of Moby-Dick.`);
    f.push(`Its pages would stack about ${(b.page_count * 0.05).toFixed(1)} cm high.`);
  }
  if (b.pub_year) {
    const age = YEAR - b.pub_year;
    if (age > 100) f.push(`First published ${age} years ago, in ${b.pub_year}.`);
    else if (age > 1) f.push(`Came out in ${b.pub_year}, ${age} years ago.`);
    else f.push(`Brand new: published in ${b.pub_year}.`);
  }
  if (b.ratings_count) f.push(`${Number(b.ratings_count).toLocaleString()} people have rated it.`);
  if (b.average_rating >= 4.2) f.push(`Rated ${Number(b.average_rating).toFixed(2)}★, top tier in the catalogue.`);
  if (b.categories?.length > 1) f.push(`Shelved under ${b.categories.slice(0, 3).join(', ')}.`);
  return f.length ? f : ['A book worth a look.'];
};

const FactTicker = ({ book, active }) => {
  const facts = useMemo(() => factsFor(book), [book]);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % facts.length), 3200);
    return () => clearInterval(id);
  }, [active, facts.length]);
  return (
    <div className="flex items-start gap-2 text-[13px] min-h-[2.6em]">
      <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-70" />
      <AnimatePresence mode="wait">
        <motion.span key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.4, ease: EASE }}>
          {facts[i]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
};

/** Takes float up over the cover like live comments. */
const FloatingTakes = ({ takes, active }) => {
  const [shown, setShown] = useState([]);
  useEffect(() => {
    if (!active || !takes.length) { setShown([]); return undefined; }
    let n = 0;
    const push = () => {
      const t = takes[n % takes.length];
      n += 1;
      setShown((s) => [...s.slice(-2), { ...t, key: `${t.take_id}-${n}` }]);
    };
    push();
    const id = setInterval(push, 2600);
    return () => clearInterval(id);
  }, [active, takes]);
  return (
    <div className="absolute left-3 right-16 bottom-[40%] flex flex-col gap-2 items-start pointer-events-none">
      <AnimatePresence initial={false}>
        {shown.map((t) => (
          <motion.div
            key={t.key}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="max-w-full rounded-[14px] bg-black/45 backdrop-blur-md text-white px-3 py-2 text-[12.5px] leading-snug"
          >
            <span className="font-semibold mr-1.5">@{t.username}</span>
            {t.vibe && <span className="mr-1">{VIBES[t.vibe]?.[0]}</span>}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const ActionButton = ({ icon: Icon, label, onClick, active, fill }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 text-white group" aria-label={label}>
    <motion.span whileTap={{ scale: 0.8 }} className={cn('w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-colors', active ? 'bg-accent-red' : 'bg-black/35 group-hover:bg-black/55')}>
      <Icon className={cn('w-[22px] h-[22px]', fill && active && 'fill-current')} />
    </motion.span>
    <span className="text-[11px] font-medium drop-shadow">{label}</span>
  </button>
);

/** One full-height reel. */
const Reel = ({ reel, active, saved, onSave, onOpenTakes, onToast }) => {
  const { book, takes } = reel;
  const [tint, setTint] = useState(['#333', '#2B1B14']);
  const [burst, setBurst] = useState(0);
  useEffect(() => { coverPalette(book.thumbnail, 3).then((p) => p.length && setTint(p)); }, [book.thumbnail]);

  const like = () => { setBurst((b) => b + 1); if (!saved) onSave(book); };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/book/${encodeURIComponent(book.title)}`);
      onToast('Link copied');
    } catch { onToast('Could not copy'); }
  };

  return (
    <section className="h-full w-full relative overflow-hidden rounded-[22px] bg-[#0d0d0d] text-white select-none">
      {/* colour wash + blurred cover */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${tint[0]}, ${tint[1] || '#2B1B14'} 70%)` }} />
      <div className="absolute inset-0 opacity-50 scale-125 blur-3xl"><CoverImage book={book} /></div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/85" />

      {/* cover, slowly zooming while on screen; double-click to save */}
      <div className="absolute inset-x-0 top-[6%] flex justify-center" onDoubleClick={like} data-cursor="Double-click">
        <motion.div
          className="w-[56%] aspect-[2/3] rounded-[6px] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]"
          animate={active ? { scale: [1, 1.06], rotate: [0, -1.5] } : { scale: 1, rotate: 0 }}
          transition={{ duration: 9, ease: 'linear' }}
        >
          <CoverImage book={book} eager />
        </motion.div>
        <AnimatePresence>
          {burst > 0 && (
            <motion.span key={burst} className="absolute top-1/3 text-accent-red pointer-events-none" initial={{ scale: 0, opacity: 1 }} animate={{ scale: [0, 1.4, 1.1], opacity: [1, 1, 0] }} transition={{ duration: 0.9, ease: EASE }}>
              <Heart className="w-28 h-28 fill-current drop-shadow-2xl" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <FloatingTakes takes={takes} active={active} />

      {/* right rail */}
      <div className="absolute right-3 bottom-[24%] flex flex-col gap-4">
        <ActionButton icon={Heart} label={saved ? 'Saved' : 'Want'} active={saved} fill onClick={like} />
        <ActionButton icon={MessageCircle} label={takes.length ? String(takes.length) : 'Take'} onClick={() => onOpenTakes(reel)} />
        <ActionButton icon={Link2} label="Share" onClick={share} />
        <Link to={`/book/${encodeURIComponent(book.title)}`} className="flex flex-col items-center gap-1 text-white group" aria-label="Open book">
          <span className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center group-hover:bg-accent-red group-hover:text-white transition-colors"><ArrowUpRight className="w-[22px] h-[22px]" /></span>
          <span className="text-[11px] font-medium">Open</span>
        </Link>
      </div>

      {/* caption */}
      <div className="absolute left-0 right-16 bottom-0 p-5">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(book.categories || []).slice(0, 3).map((g) => <span key={g} className="text-[10.5px] px-2 py-0.5 rounded-full bg-white/15 backdrop-blur">{g}</span>)}
        </div>
        <p className="font-serif text-[2rem] leading-[0.95] line-clamp-2">{book.title}</p>
        <p className="text-[13px] mt-1.5 opacity-85 line-clamp-1">{book.authors?.join(', ')} · ★ {Number(book.average_rating || 0).toFixed(2)}</p>
        <div className="mt-3 opacity-90"><FactTicker book={book} active={active} /></div>
      </div>

      {/* progress line while on screen */}
      {active && <motion.div className="absolute top-0 left-0 h-[3px] bg-white/80" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 9, ease: 'linear' }} />}
    </section>
  );
};

/** Takes on one book: list + composer. The side panel on desktop, a sheet on mobile. */
const TakesPanel = ({ reel, onClose, onChanged }) => {
  const { currentUser, loginWithGoogle } = useAuth();
  const [text, setText] = useState('');
  const [vibe, setVibe] = useState('fun_fact');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const { book, takes } = reel;

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const t = await postTake(book.book_id, text.trim(), vibe);
      onChanged(book.book_id, [t, ...takes]);
      setText('');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Could not post');
    } finally {
      setBusy(false);
    }
  };
  const toggleLike = async (t) => {
    const r = await likeTake(t.take_id);
    onChanged(book.book_id, takes.map((x) => (x.take_id === t.take_id ? { ...x, ...r } : x)));
  };
  const remove = async (t) => {
    await deleteTake(t.take_id);
    onChanged(book.book_id, takes.filter((x) => x.take_id !== t.take_id));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
        <div className="min-w-0">
          <p className="label">Takes on</p>
          <p className="font-serif text-[1.6rem] leading-tight line-clamp-2">{book.title}</p>
        </div>
        {onClose && <button onClick={onClose} className="w-9 h-9 rounded-full border border-border flex items-center justify-center shrink-0" aria-label="Close"><X className="w-4 h-4" /></button>}
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-[120px]" data-lenis-prevent>
        {!currentUser && (
          <p className="text-[13px] text-text-muted">
            Takes are for followers only. <button onClick={loginWithGoogle} className="text-text-main link-under">Sign in</button> to see what people you follow said and post your own.
          </p>
        )}
        {currentUser && takes.length === 0 && <p className="font-serif italic text-2xl text-text-muted">No takes yet from you or anyone you follow. Start one.</p>}
        <AnimatePresence initial={false}>
          {takes.map((t) => (
            <motion.div key={t.take_id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="flex gap-3">
              <Avatar username={t.username} size="w-9 h-9 text-sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px]">
                  <Link to={`/u/${t.username}`} className="font-semibold link-draw">@{t.username}</Link>
                  <span className="text-text-muted ml-2">{timeAgo(t.created_at)}</span>
                </p>
                {t.vibe && VIBES[t.vibe] && <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full bg-text-main/[0.07]">{VIBES[t.vibe][0]} {VIBES[t.vibe][1]}</span>}
                <p className="text-[14px] leading-[1.45] mt-1 break-words">{t.text}</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <button onClick={() => toggleLike(t)} aria-label="Like take" className={cn('transition-colors', t.liked ? 'text-accent-red' : 'text-text-muted hover:text-text-main')}>
                  <Heart className={cn('w-4 h-4', t.liked && 'fill-current')} />
                </button>
                <span className="text-[10px] tabular-nums text-text-muted">{t.likes || ''}</span>
                {t.mine && <button onClick={() => remove(t)} aria-label="Delete take" className="text-text-muted hover:text-accent-red mt-1"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {currentUser && (
        <form onSubmit={submit} className="pt-4 border-t border-border">
          <div className="flex gap-1.5 overflow-x-auto pb-2" data-lenis-prevent>
            {Object.entries(VIBES).map(([k, [emoji, label]]) => (
              <button type="button" key={k} onClick={() => setVibe(k)} className={cn('h-8 px-3 rounded-full border text-[12px] whitespace-nowrap transition-colors', vibe === k ? 'bg-text-main text-bg-base border-text-main' : 'border-border hover:border-text-main')}>
                {emoji} {label}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2 mt-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 280))}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }}
              rows={2}
              placeholder="A fun fact, a hot take, a line you loved…"
              className="flex-1 resize-none rounded-[14px] border border-border bg-bg-base px-3.5 py-2.5 text-[14px] outline-none focus:border-text-main"
            />
            <motion.button whileTap={{ scale: 0.9 }} disabled={busy || !text.trim()} className="w-11 h-11 rounded-full bg-accent-red text-white flex items-center justify-center disabled:opacity-40" aria-label="Post take">
              <Send className="w-4 h-4" />
            </motion.button>
          </div>
          <p className="flex items-center justify-between text-[11px] text-text-muted mt-2">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> Only people who follow you can see this</span>
            <span className="tabular-nums">{text.length}/280</span>
          </p>
          {error && <p className="text-[12px] text-accent-red mt-1">{error}</p>}
        </form>
      )}
    </div>
  );
};

const ReelsPage = () => {
  const { currentUser, loginWithGoogle, loading: authLoading } = useAuth();
  const [mode, setMode] = useState('for_you');
  const [genre, setGenre] = useState(null);
  const [genres, setGenres] = useState([]);
  const [reels, setReels] = useState([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(() => new Set());
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState(null);
  const scroller = useRef(null);
  const busy = useRef(false);

  const load = useCallback(async (reset) => {
    if (busy.current && !reset) return;
    busy.current = true;
    setLoading(true);
    try {
      const r = await getReels(mode, genre);
      setReels((prev) => {
        if (reset) return r;
        const have = new Set(prev.map((x) => x.book.book_id));
        return [...prev, ...r.filter((x) => !have.has(x.book.book_id))];
      });
    } catch { /* ignore */ } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [mode, genre]);

  useEffect(() => { getGenreIndex().then(setGenres).catch(() => {}); }, []);
  useEffect(() => {
    if (authLoading) return;
    setReels([]);
    setActive(0);
    scroller.current?.scrollTo({ top: 0 });
    load(true);
  }, [load, authLoading, currentUser]);

  // Which reel is on screen: every reel is exactly one screen tall
  const onScroll = (e) => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
    if (i !== active) setActive(Math.max(0, Math.min(reels.length - 1, i)));
  };

  // Endless: fetch more near the end (the following feed is finite)
  useEffect(() => {
    if (mode === 'for_you' && reels.length && active >= reels.length - 3) load(false);
  }, [active, reels.length, mode, load]);

  // Step by whole reels; a press during a scroll counts from where that scroll is heading
  const target = useRef(0);
  const lastGo = useRef(0);
  const go = (dir) => {
    const root = scroller.current;
    if (!root) return;
    const count = root.querySelectorAll('[data-index]').length;
    const from = Date.now() - lastGo.current < 700 ? target.current : Math.round(root.scrollTop / root.clientHeight);
    target.current = Math.max(0, Math.min(count - 1, from + dir));
    lastGo.current = Date.now();
    root.scrollTo({ top: target.current * root.clientHeight, behavior: 'smooth' });
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); go(1); }
      if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(null), 1800); };
  const save = async (book) => {
    if (!currentUser) { flash('Sign in to save books'); return; }
    setSaved((s) => new Set(s).add(book.book_id));
    try { await setShelf(book.book_id, 'want_to_read'); flash('Added to Want to read'); } catch { flash('Could not save'); }
  };
  const setTakes = (bookId, takes) => setReels((rs) => rs.map((r) => (r.book.book_id === bookId ? { ...r, takes } : r)));
  const pickMode = (k) => (k === 'following' && !currentUser ? loginWithGoogle() : setMode(k));
  const current = reels[active];
  const sheetReel = sheet && reels.find((r) => r.book.book_id === sheet);

  return (
    <div className="px-3 sm:px-8 lg:px-10 pb-10">
      <div className="grid lg:grid-cols-[1fr_minmax(0,440px)_1fr] gap-8 xl:gap-16 items-start">
        {/* Left: feed controls */}
        <aside className="hidden lg:block pt-2">
          <p className="label">( Reels )</p>
          <h1 className="font-wide font-semibold uppercase text-[clamp(2.4rem,4vw,4rem)] leading-[0.9] tracking-[-0.03em] mt-2">
            Book<br /><span className="font-serif italic normal-case font-normal text-accent-red">reels</span>
          </h1>
          <p className="text-[14px] text-text-muted mt-4 max-w-[19rem]">
            One book per screen. Scroll for the next one, double-click a cover to save it, and leave takes that only your followers can see.
          </p>

          <div className="relative flex p-1 rounded-full border border-border mt-8 w-max">
            {[['for_you', 'For you'], ['following', 'Following']].map(([k, l]) => (
              <button key={k} onClick={() => pickMode(k)} className={cn('relative h-9 px-4 rounded-full text-[13px]', mode === k && 'text-bg-base')}>
                {mode === k && <motion.span layoutId="reel-mode" className="absolute inset-0 rounded-full bg-text-main" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className="relative">{l}</span>
              </button>
            ))}
          </div>

          {mode === 'for_you' && (
            <div className="mt-6">
              <p className="label mb-2">Genre</p>
              <div className="flex flex-wrap gap-1.5 max-w-[22rem]">
                {[null, ...genres.slice(0, 18).map((g) => g.name)].map((g) => (
                  <button key={g ?? 'all'} onClick={() => setGenre(g)} className={cn('h-8 px-3 rounded-full border text-[12px] transition-colors', genre === g ? 'bg-text-main text-bg-base border-text-main' : 'border-border hover:border-text-main')}>
                    {g ?? 'Everything'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center gap-2 text-[12px] text-text-muted">
            <kbd className="w-7 h-7 rounded-md border border-border flex items-center justify-center"><ChevronUp className="w-3.5 h-3.5" /></kbd>
            <kbd className="w-7 h-7 rounded-md border border-border flex items-center justify-center"><ChevronDown className="w-3.5 h-3.5" /></kbd>
            to move between reels
          </div>
        </aside>

        {/* Centre: the reel column */}
        <div className="relative">
          <div className="lg:hidden flex justify-center gap-6 mb-3 text-[14px]">
            {[['for_you', 'For you'], ['following', 'Following']].map(([k, l]) => (
              <button key={k} onClick={() => pickMode(k)} className={cn('pb-1 border-b-2', mode === k ? 'border-text-main font-medium' : 'border-transparent text-text-muted')}>{l}</button>
            ))}
          </div>
          <div
            ref={scroller}
            onScroll={onScroll}
            data-lenis-prevent
            className="h-[calc(100dvh-140px)] lg:h-[calc(100vh-120px)] min-h-[520px] overflow-y-auto snap-y snap-mandatory rounded-[22px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {reels.map((r, i) => (
              <div key={r.book.book_id} data-index={i} className="h-full snap-start snap-always">
                <Reel reel={r} active={i === active} saved={saved.has(r.book.book_id)} onSave={save} onOpenTakes={(x) => setSheet(x.book.book_id)} onToast={flash} />
              </div>
            ))}
            {!reels.length && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 rounded-[22px] border border-dashed border-border">
                <Bookmark className="w-8 h-8 mb-4" />
                <p className="font-serif text-3xl">Nothing here yet</p>
                <p className="text-[13px] text-text-muted mt-2 max-w-xs">
                  {mode === 'following' ? 'When people you follow post takes, their books show up here.' : 'No books matched.'}
                </p>
              </div>
            )}
            {loading && !reels.length && <div className="h-full flex items-center justify-center label">Loading reels…</div>}
          </div>
          <div className="hidden lg:flex flex-col gap-2 absolute -right-14 top-1/2 -translate-y-1/2">
            <button onClick={() => go(-1)} className="w-10 h-10 rounded-full border border-border hover:bg-text-main hover:text-bg-base flex items-center justify-center transition-colors" aria-label="Previous reel"><ChevronUp className="w-4 h-4" /></button>
            <button onClick={() => go(1)} className="w-10 h-10 rounded-full border border-border hover:bg-text-main hover:text-bg-base flex items-center justify-center transition-colors" aria-label="Next reel"><ChevronDown className="w-4 h-4" /></button>
          </div>
          <AnimatePresence>
            {toast && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute left-1/2 -translate-x-1/2 bottom-6 z-20 px-4 py-2 rounded-full bg-white text-black text-[13px] font-medium shadow-brutal-lg whitespace-nowrap">
                {toast}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: takes on the reel on screen */}
        <aside className="hidden lg:block h-[calc(100vh-120px)] min-h-[520px] rounded-[22px] border border-border bg-surface-white p-5">
          {current ? <TakesPanel key={current.book.book_id} reel={current} onChanged={setTakes} /> : <p className="label">Takes appear here.</p>}
        </aside>
      </div>

      {/* Mobile takes sheet */}
      <AnimatePresence>
        {sheetReel && (
          <motion.div className="lg:hidden fixed inset-0 z-[130] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(null)}>
            <motion.div
              className="absolute inset-x-0 bottom-0 h-[75vh] rounded-t-[22px] bg-bg-base p-5"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ duration: 0.5, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
            >
              <TakesPanel reel={sheetReel} onClose={() => setSheet(null)} onChanged={setTakes} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReelsPage;
