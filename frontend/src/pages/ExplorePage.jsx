import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, Library, Shuffle, X } from 'lucide-react';
import BookCard from '../components/BookCard';
import Bookshelf from '../components/Bookshelf';
import NeoButton, { cn } from '../components/NeoButton';
import { CoverImage, EASE, ErrorBox, Page, PageTitle, Spinner } from '../components/ui';
import { browseBooks, errorMessage, getGenreIndex, getRandomBook } from '../services/api';

const SORTS = [
  ['popular', 'Most read'],
  ['rating', 'Highest rated'],
  ['newest', 'Newest'],
  ['oldest', 'Oldest'],
  ['shortest', 'Shortest'],
  ['longest', 'Longest'],
  ['title', 'A–Z'],
];
const LENGTHS = [[null, 'Any length'], [200, 'Under 200 pages'], [300, 'Under 300'], [400, 'Under 400']];
const RATINGS = [[null, 'Any rating'], [3.5, '3.5+'], [4, '4+'], [4.5, '4.5+']];
const DECADES = [null, 2020, 2010, 2000, 1990, 1980, 1970, 1960, 1950, 1900, 1850, 1800];
const PAGE = 30;

const Chip = ({ active, children, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'h-8 px-3.5 rounded-full border text-[12px] whitespace-nowrap transition-colors',
      active ? 'bg-text-main text-bg-base border-text-main' : 'border-border hover:border-text-main'
    )}
  >
    {children}
  </button>
);

/** "Spin the shelf": covers flick past like a slot machine, then land on a random book. */
const Roulette = ({ genre }) => {
  const [spinning, setSpinning] = useState(false);
  const [reel, setReel] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const spin = async () => {
    setError(null);
    setResult(null);
    setSpinning(true);
    try {
      const picks = await Promise.all(Array.from({ length: 7 }, () => getRandomBook(genre)));
      setReel(picks);
      setTimeout(() => { setResult(picks[picks.length - 1]); setSpinning(false); }, 1700);
    } catch (e) {
      setError(errorMessage(e, 'No book found'));
      setSpinning(false);
    }
  };

  return (
    <div className="border border-border rounded-[10px] p-5 bg-surface-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Can’t decide?</p>
          <p className="font-wide font-medium text-[14px] mt-1">Spin the shelf</p>
          <p className="text-[12px] text-text-muted mt-1">A random well-rated book{genre ? ` in ${genre}` : ''}.</p>
        </div>
        <NeoButton size="sm" onClick={spin} disabled={spinning}><Shuffle className="w-3.5 h-3.5 mr-1.5" /> Spin</NeoButton>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <AnimatePresence mode="wait">
        {(spinning || result) && (
          <motion.div key={result ? `r-${result.book_id}` : 'spin'} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }} className="overflow-hidden">
            <div className="flex gap-4 items-center mt-5">
              <div className="relative w-20 aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover shrink-0 bg-bg-base">
                {spinning ? (
                  <motion.div className="absolute inset-x-0 top-0" animate={{ y: ['0%', `-${(reel.length - 1) * 100}%`] }} transition={{ duration: 1.6, ease: [0.5, 0, 0.1, 1] }}>
                    {reel.map((b, i) => <div key={`${b.book_id}-${i}`} className="w-20 aspect-[2/3]"><CoverImage book={b} eager /></div>)}
                  </motion.div>
                ) : result && <CoverImage book={result} />}
              </div>
              {result && !spinning && (
                <div className="min-w-0">
                  <Link to={`/book/${encodeURIComponent(result.title)}`} className="font-medium text-[14px] link-draw line-clamp-2">{result.title}</Link>
                  <p className="label mt-1">{result.authors?.join(', ')}</p>
                  <p className="label mt-1">★ {Number(result.average_rating).toFixed(1)} · {result.pub_year || '—'}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ExplorePage = () => {
  const [params, setParams] = useSearchParams();
  const genre = params.get('genre');
  const sort = params.get('sort') || 'popular';
  const decade = params.get('decade') ? Number(params.get('decade')) : null;
  const maxPages = params.get('pages') ? Number(params.get('pages')) : null;
  const minRating = params.get('rating') ? Number(params.get('rating')) : null;

  const [genres, setGenres] = useState([]);
  const [books, setBooks] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [genreFilter, setGenreFilter] = useState('');
  const [view, setView] = useState(() => { try { return localStorage.getItem('booklog-explore-view') || 'grid'; } catch { return 'grid'; } });
  const pickView = (v) => { setView(v); try { localStorage.setItem('booklog-explore-view', v); } catch { /* ignore */ } };
  const sentinel = useRef(null);
  const busy = useRef(false);
  const queryKey = `${genre}|${sort}|${decade}|${maxPages}|${minRating}`;

  const set = (k, v) => {
    const next = new URLSearchParams(params);
    if (v === null || v === undefined || v === '') next.delete(k); else next.set(k, v);
    setParams(next, { replace: true });
  };

  useEffect(() => { getGenreIndex().then(setGenres).catch(() => {}); }, []);

  const load = useCallback(async (offset) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const r = await browseBooks({ genre: genre || undefined, sort, decade: decade ?? undefined, max_pages: maxPages || undefined, min_rating: minRating ?? undefined, offset, limit: PAGE });
      setTotal(r.total);
      setBooks((prev) => (offset === 0 ? r.books : [...prev, ...r.books]));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useEffect(() => { setBooks([]); setTotal(null); load(0); }, [load]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && total !== null && books.length < total) load(books.length);
    }, { rootMargin: '800px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [books.length, total, load]);

  const shownGenres = genres.filter((g) => g.name.toLowerCase().includes(genreFilter.toLowerCase()));
  const activeFilters = [genre, decade, maxPages, minRating].filter((v) => v !== null && v !== undefined).length;

  return (
    <Page>
      <PageTitle
        kicker="( Explore ) the whole catalogue"
        right={total !== null && <p className="label text-right">{total.toLocaleString()} books<br />match</p>}
      >
        <span>{genre || 'Every'}</span>
        <span className="font-serif italic normal-case text-accent-red">{genre ? 'books' : 'book'}</span>
      </PageTitle>

      <div className="grid lg:grid-cols-12 gap-10">
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-8 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2" data-lenis-prevent>
          <Roulette genre={genre} />
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <p className="label">Genres</p>
              {genre && <button onClick={() => set('genre', null)} className="label link-under">Clear</button>}
            </div>
            <input
              value={genreFilter}
              onChange={(e) => setGenreFilter(e.target.value)}
              placeholder="Filter genres…"
              className="w-full bg-transparent border-b border-border pb-2 mb-3 text-[13px] outline-none focus:border-text-main placeholder:text-text-muted"
            />
            <ul className="space-y-0.5 max-h-[45vh] lg:max-h-none overflow-y-auto" data-lenis-prevent>
              {shownGenres.map((g) => (
                <li key={g.name}>
                  <button
                    onClick={() => set('genre', genre === g.name ? null : g.name)}
                    className={cn('w-full flex items-baseline justify-between py-1 text-left text-[13px] group', genre === g.name ? 'text-accent-red' : 'hover:pl-1.5 transition-[padding] duration-300')}
                  >
                    <span className={cn(genre === g.name && 'font-medium')}>{g.name}</span>
                    <span className="label tabular-nums">{g.book_count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Results */}
        <div className="lg:col-span-9">
          <div className="space-y-3 mb-10">
            <div className="flex gap-2 overflow-x-auto pb-1" data-lenis-prevent>
              {SORTS.map(([k, l]) => <Chip key={k} active={sort === k} onClick={() => set('sort', k === 'popular' ? null : k)}>{l}</Chip>)}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" data-lenis-prevent>
              {DECADES.map((d) => <Chip key={d ?? 'all'} active={decade === d} onClick={() => set('decade', d)}>{d === null ? 'All years' : `${d}s`}</Chip>)}
            </div>
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map(([v, l]) => <Chip key={l} active={maxPages === v} onClick={() => set('pages', v)}>{l}</Chip>)}
              <span className="w-px bg-border mx-1" />
              {RATINGS.map(([v, l]) => <Chip key={l} active={minRating === v} onClick={() => set('rating', v)}>{l}</Chip>)}
              {activeFilters > 0 && (
                <button onClick={() => setParams({}, { replace: true })} className="h-8 px-3 text-[12px] flex items-center gap-1 text-accent-red">
                  <X className="w-3.5 h-3.5" /> Reset all
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3 mb-8">
            <span className="label tabular-nums">Showing {books.length.toLocaleString()}{total !== null ? ` of ${total.toLocaleString()}` : ''}</span>
            <div className="relative flex p-1 rounded-full border border-border">
              {[['grid', 'Grid', LayoutGrid], ['shelf', 'Shelf', Library]].map(([v, l, Icon]) => (
                <button key={v} onClick={() => pickView(v)} className={cn('relative h-8 px-3.5 rounded-full text-[12px] flex items-center gap-1.5 transition-colors', view === v ? 'text-bg-base' : '')}>
                  {view === v && <motion.span layoutId="explore-view" className="absolute inset-0 rounded-full bg-text-main" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <Icon className="relative w-3.5 h-3.5" /><span className="relative">{l}</span>
                </button>
              ))}
            </div>
          </div>

          <ErrorBox>{error}</ErrorBox>
          {view === 'shelf' ? <Bookshelf books={books} /> : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
            {books.map((b, i) => (
              <motion.div
                key={b.book_id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: EASE, delay: (i % PAGE) * 0.025 }}
              >
                <BookCard book={b} source="explore" />
              </motion.div>
            ))}
          </div>
          )}
          {!loading && total === 0 && <p className="font-serif italic text-3xl text-center py-20">No books match these filters.</p>}
          <div ref={sentinel} className="h-10" />
          {loading && <Spinner label={books.length ? 'Loading more' : 'Loading'} />}
          {total !== null && books.length >= total && total > 0 && (
            <p className="label text-center pt-10">That’s all {total.toLocaleString()}. Try another genre.</p>
          )}
        </div>
      </div>
    </Page>
  );
};

export default ExplorePage;
