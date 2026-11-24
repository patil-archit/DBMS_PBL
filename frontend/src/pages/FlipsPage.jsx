import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, ChevronDown, ChevronUp, Heart, Link2, Globe, MessageCircle, Send, Sparkles, Trash2, X } from 'lucide-react';
import { cn } from '../components/NeoButton';
import { Avatar, Chip, CoverImage, EASE, timeAgo } from '../components/ui';
import { Book3D, DogEar } from '../components/Dogs';
import { useAuth } from '../contexts/AuthContext';
import { coverPalette } from '../utils/colors';
import { deleteTake, getFlips, getGenreIndex, likeTake, postTake, setShelf } from '../services/api';

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
const MODES = [['for_you', 'For you'], ['latest', 'Latest'], ['following', 'Following']];

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
      setShown((s) => [...s.filter((o) => o.take_id !== t.take_id).slice(-2), { ...t, key: `${t.take_id}-${n}` }]);
    };
    push();
    if (takes.length < 2) return undefined; // one take: show it once, no cycling
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
    <motion.span whileTap={{ scale: 0.8 }} className={cn('w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 group-hover:-rotate-12 group-hover:scale-110', active ? 'bg-red text-[#FBFBF4]' : 'bg-[#FBFBF4] text-red')}>
      <Icon className={cn('w-[22px] h-[22px]', fill && active && 'fill-current')} />
    </motion.span>
    <span className="font-main caps text-[10px] drop-shadow">{label}</span>
  </button>
);

/** One full-height reel. */
const Reel = ({ reel, active, saved, onSave, onOpenTakes, onToast }) => {
  const { book, takes } = reel;
  const [tint, setTint] = useState(['#E33529', '#8E1F17']);
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
    <section className="h-full w-full relative overflow-hidden rounded-[32px] text-[#FBFBF4] select-none">
      {/* the cover's own colours as the background */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(165deg, ${tint[0]}, ${tint[1] || '#8E1F17'} 75%)` }} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
      <span className="absolute -right-24 -top-24 w-72 h-72 rounded-full bg-white/10" />

      {/* the book in 3D, floating while on screen; double-click to save */}
      <div className="absolute inset-x-0 top-[7%] flex justify-center" onDoubleClick={like} data-cursor="Double-click">
        <motion.div animate={active ? { y: [0, -10, 0] } : { y: 0 }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
          <Book3D book={book} width={200} idle={-22}><CoverImage book={book} eager /></Book3D>
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
          <span className="w-12 h-12 rounded-full bg-red text-[#FBFBF4] flex items-center justify-center transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110"><ArrowUpRight className="w-[22px] h-[22px]" /></span>
          <span className="font-main caps text-[10px]">Open</span>
        </Link>
      </div>

      {/* caption */}
      <div className="absolute left-0 right-16 bottom-0 p-6">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(book.categories || []).slice(0, 3).map((g) => <span key={g} className="caps text-[10px] px-2.5 py-1 rounded-full bg-[#FBFBF4]/20">{g}</span>)}
        </div>
        <p className="font-display text-[2.6rem] leading-[0.9] line-clamp-2">{book.title}</p>
        <p className="text-[13px] mt-1.5 opacity-85 line-clamp-1">{book.authors?.join(', ')} · ★ {Number(book.average_rating || 0).toFixed(2)}</p>
        <div className="mt-3 opacity-90"><FactTicker book={book} active={active} /></div>
      </div>

      {/* progress line while on screen */}
      {active && <motion.div className="absolute top-0 left-0 h-[4px] bg-[#FBFBF4]" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 9, ease: 'linear' }} />}
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
          <p className="caps">Takes on</p>
          <p className="font-display text-[2.2rem] mt-1 line-clamp-2">{book.title}</p>
        </div>
        {onClose && <button onClick={onClose} className="w-9 h-9 rounded-full border border-border flex items-center justify-center shrink-0" aria-label="Close"><X className="w-4 h-4" /></button>}
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-[120px]" data-lenis-prevent>
        {!currentUser && (
          <p className="text-[13px] text-text-muted">
            <button onClick={loginWithGoogle} className="font-main normal-case text-text-main link-under">Sign in</button> to post your own take and like other people’s.
          </p>
        )}
        {takes.length === 0 && <p className="font-display text-3xl text-text-muted">No takes yet. {currentUser ? 'Start one.' : ''}</p>}
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
            <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> Everyone can see this, unless your account is private</span>
            <span className="tabular-nums">{text.length}/280</span>
          </p>
          {error && <p className="text-[12px] text-accent-red mt-1">{error}</p>}
        </form>
      )}
    </div>
  );
};

const FlipsPage = () => {
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
      const r = await getFlips(mode, genre);
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

  // Endless: fetch more near the end (the latest and following feeds are finite)
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
    <div className="max-w-[1400px] mx-auto px-3 sm:px-8 lg:px-10 pt-4 pb-16">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)_minmax(0,1fr)] gap-8 xl:gap-14 items-start">
        {/* Left: feed controls */}
        <aside className="hidden lg:flex flex-col h-[calc(100vh-130px)] min-h-[520px]">
          <p className="caps">( Flips )</p>
          <h1 className="font-display text-[clamp(3.6rem,6vw,6.4rem)] mt-3">Flip<br />through</h1>
          <p className="text-[14px] text-text-muted mt-4 max-w-[20rem] leading-relaxed">
            One book per screen. Scroll to flip to the next, double-click a cover to save it, and see what everyone is saying about it.
          </p>

          <div className="relative flex p-1 rounded-full bg-surface-white mt-6 w-max">
            {MODES.map(([k, l]) => (
              <button key={k} onClick={() => pickMode(k)} className={cn('relative h-10 px-5 rounded-full text-[19px]', mode === k && 'text-[#FBFBF4]')}>
                {mode === k && <motion.span layoutId="reel-mode" className="absolute inset-0 rounded-full bg-red" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className="relative">{l}</span>
              </button>
            ))}
          </div>

          {mode === 'for_you' && (
            <div className="mt-6">
              <p className="caps mb-3">Genre</p>
              <div className="flex flex-wrap gap-2 max-w-[24rem]">
                {[null, ...genres.slice(0, 9).map((g) => g.name)].map((g) => (
                  <Chip key={g ?? 'all'} active={genre === g} onClick={() => setGenre(g)}>{g ?? 'Everything'}</Chip>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto flex items-end justify-between gap-4 pt-6">
            <div className="flex gap-2">
              <button onClick={() => go(-1)} className="w-14 h-14 rounded-full bg-[#FBFBF4] text-red flex items-center justify-center hover:-rotate-12 hover:scale-110 transition-transform duration-300" aria-label="Previous reel"><ChevronUp className="w-6 h-6" /></button>
              <button onClick={() => go(1)} className="w-14 h-14 rounded-full bg-red text-[#FBFBF4] flex items-center justify-center hover:rotate-12 hover:scale-110 transition-transform duration-300" aria-label="Next reel"><ChevronDown className="w-6 h-6" /></button>
            </div>
            <DogEar animal="fox" prop="cap" seed={9} body={false} ribbon={false} className="w-24 xl:w-28" />
          </div>
        </aside>

        {/* Centre: the reel column */}
        <div className="relative">
          <div className="lg:hidden flex justify-center gap-6 mb-3 text-[14px]">
            {MODES.map(([k, l]) => (
              <button key={k} onClick={() => pickMode(k)} className={cn('pb-1 border-b-2 text-[20px]', mode === k ? 'border-text-main' : 'border-transparent text-text-muted')}>{l}</button>
            ))}
          </div>
          <div
            ref={scroller}
            onScroll={onScroll}
            data-lenis-prevent
            className="h-[calc(100dvh-150px)] lg:h-[calc(100vh-130px)] min-h-[520px] overflow-y-auto snap-y snap-mandatory rounded-[32px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {reels.map((r, i) => (
              <div key={r.book.book_id} data-index={i} className="h-full snap-start snap-always">
                <Reel reel={r} active={i === active} saved={saved.has(r.book.book_id)} onSave={save} onOpenTakes={(x) => setSheet(x.book.book_id)} onToast={flash} />
              </div>
            ))}
            {!reels.length && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 rounded-[32px] bg-surface-white">
                <DogEar animal="owl" seed={4} body={false} ribbon={false} className="w-32 mb-6" />
                <p className="font-display text-5xl">Nothing here yet</p>
                <p className="text-[13px] text-text-muted mt-2 max-w-xs">
                  {mode === 'following' ? 'When people you follow post takes, their books show up here.' : mode === 'latest' ? 'No takes yet. Be the first to post one.' : 'No books matched.'}
                </p>
              </div>
            )}
            {loading && !reels.length && <div className="h-full flex items-center justify-center caps">Flipping…</div>}
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
        <aside className="hidden lg:block h-[calc(100vh-130px)] min-h-[520px] rounded-[32px] bg-surface-white p-7">
          {current ? <TakesPanel key={current.book.book_id} reel={current} onChanged={setTakes} /> : <p className="caps">Takes appear here.</p>}
        </aside>
      </div>

      {/* Mobile takes sheet */}
      <AnimatePresence>
        {sheetReel && (
          <motion.div className="lg:hidden fixed inset-0 z-[130] bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(null)}>
            <motion.div
              className="absolute inset-x-0 bottom-0 h-[75vh] rounded-t-[32px] bg-bg-base p-6"
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

export default FlipsPage;
