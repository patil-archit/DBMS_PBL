import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, Check, Plus, X } from 'lucide-react';
import BookCard from '../components/BookCard';
import { cn } from '../components/NeoButton';
import { EASE, ErrorBox, Page, Select, Tabs } from '../components/ui';
import { followAuthor, getGenres, getLanguages, searchBooks, unfollowAuthor } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const SUGGESTIONS = ['hary poter', 'tolkein', 'dystopian', 'agatha christy', 'sapiens', 'murakami', 'pride prejudice'];

const AuthorRow = ({ author, onToggle, busy, signedIn }) => (
  <div className="group grid grid-cols-12 items-center gap-4 py-4 border-b border-border">
    <Link to={`/author/${encodeURIComponent(author.name)}`} className="col-span-2 sm:col-span-1">
      {author.image_url ? (
        <img src={author.image_url} alt="" className="w-12 h-12 rounded-full object-cover grayscale group-hover:grayscale-0 transition duration-500" />
      ) : (
        <span className="w-12 h-12 rounded-full bg-text-main text-bg-base flex items-center justify-center font-serif text-xl">{author.name[0]}</span>
      )}
    </Link>
    <Link to={`/author/${encodeURIComponent(author.name)}`} className="col-span-10 sm:col-span-5 min-w-0">
      <p className="caps font-medium text-[15px] truncate group-hover:text-accent-red transition-colors">{author.name}</p>
      <p className="label mt-0.5">{author.book_count} books</p>
    </Link>
    <p className="hidden sm:block col-span-4 text-[12px] text-text-muted line-clamp-2">{author.description || 'No biography yet.'}</p>
    <div className="col-span-12 sm:col-span-2 flex sm:justify-end">
      <button
        disabled={busy}
        onClick={() => onToggle(author)}
        className={cn('h-8 px-3.5 rounded-full border text-[12px] inline-flex items-center gap-1.5 transition-colors', author.is_followed ? 'bg-text-main text-bg-base border-text-main' : 'border-border hover:border-text-main')}
      >
        {author.is_followed ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
        {author.is_followed ? 'Following' : signedIn ? 'Follow' : 'Sign in to follow'}
      </button>
    </div>
  </div>
);

const SearchPage = () => {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const genre = params.get('genre') || '';
  const language = params.get('language') || '';
  const minRating = params.get('min_rating') || '';
  const hasFilters = !!(genre || language || minRating);

  const { currentUser, loginWithGoogle } = useAuth();
  const [input, setInput] = useState(q);
  const [results, setResults] = useState({ books: [], authors: [], genres: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const [ms, setMs] = useState(null);
  const [tab, setTab] = useState('books');
  const [busy, setBusy] = useState({});
  const [genreOptions, setGenreOptions] = useState([]);
  const [languageOptions, setLanguageOptions] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    getGenres().then(setGenreOptions).catch(() => {});
    getLanguages().then(setLanguageOptions).catch(() => {});
    inputRef.current?.focus();
  }, []);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  // Live search: typing updates ?q= after a short pause
  useEffect(() => {
    const id = setTimeout(() => { if (input.trim() !== q) setParam('q', input.trim()); }, 260);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => {
    if (!q.trim() && !hasFilters) { setSearched(false); setResults({ books: [], authors: [], genres: [] }); return undefined; }
    let live = true;
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    searchBooks(q, { genre: genre || undefined, language: language || undefined, min_rating: minRating || undefined })
      .then((data) => {
        if (!live) return;
        setResults(data);
        setMs(Math.round(performance.now() - t0));
        setSearched(true);
        if (!data.books.length && data.authors.length) setTab('authors');
        else setTab('books');
      })
      .catch(() => live && setError('Search failed. Please try again.'))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [q, genre, language, minRating, hasFilters, currentUser]);

  const toggleFollow = async (author) => {
    if (!currentUser) { loginWithGoogle(); return; }
    setBusy((b) => ({ ...b, [author.name]: true }));
    try {
      await (author.is_followed ? unfollowAuthor(author.name) : followAuthor(author.name));
      setResults((r) => ({ ...r, authors: r.authors.map((a) => (a.name === author.name ? { ...a, is_followed: !a.is_followed } : a)) }));
    } finally {
      setBusy((b) => ({ ...b, [author.name]: false }));
    }
  };

  const total = results.books.length + results.authors.length + results.genres.length;

  return (
    <Page>
      <div className="flex justify-between border-t border-border pt-3 mb-8">
        <span className="label">( Search ) titles, authors, genres or ISBN</span>
        <span className="label tabular-nums">
          {loading ? 'Searching…' : searched ? `${total} results${ms !== null ? ` · ${ms} ms` : ''}` : 'Spelling mistakes allowed'}
        </span>
      </div>

      {/* Giant input */}
      <form onSubmit={(e) => { e.preventDefault(); setParam('q', input.trim()); }} className="relative">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type anything…"
          aria-label="Search"
          className="w-full bg-transparent font-wide font-medium text-[clamp(2rem,6.5vw,6rem)] leading-none pb-4 outline-none placeholder:text-text-main/15 border-b border-text-main"
        />
        {input && (
          <button type="button" onClick={() => { setInput(''); setParam('q', ''); inputRef.current?.focus(); }} aria-label="Clear search" className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full border border-border flex items-center justify-center hover:bg-text-main hover:text-bg-base transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
        <motion.span
          className="absolute left-0 bottom-0 h-px bg-accent-red origin-left w-full"
          animate={{ scaleX: loading ? [0, 1] : 0 }}
          transition={{ duration: 0.8, ease: EASE, repeat: loading ? Infinity : 0 }}
        />
      </form>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-6">
        <Select aria-label="Genre" value={genre} onChange={(e) => setParam('genre', e.target.value)}>
          <option value="">All genres</option>
          {genreOptions.map((g) => <option key={g.genre_id} value={g.name}>{g.name} ({g.book_count})</option>)}
        </Select>
        <Select aria-label="Language" value={language} onChange={(e) => setParam('language', e.target.value)}>
          <option value="">Any language</option>
          {languageOptions.map((l) => <option key={l.language} value={l.language}>{l.language.toUpperCase()} ({l.book_count})</option>)}
        </Select>
        <Select aria-label="Minimum rating" value={minRating} onChange={(e) => setParam('min_rating', e.target.value)}>
          <option value="">Any rating</option>
          {[4.5, 4, 3.5, 3].map((r) => <option key={r} value={r}>{r}+ stars</option>)}
        </Select>
        {hasFilters && (
          <button className="label !text-accent-red text-left sm:text-center" onClick={() => setParams(q ? { q } : {}, { replace: true })}>Clear filters</button>
        )}
      </div>

      <div className="mt-14">
        <ErrorBox>{error}</ErrorBox>

        {!searched && !loading && (
          <div>
            <p className="label mb-4">Try a deliberately misspelled one</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => setInput(s)} className="h-10 px-4 rounded-full border border-border text-[14px] hover:bg-text-main hover:text-bg-base transition-colors inline-flex items-center gap-2">
                  {s} <ArrowUpRight className="w-3.5 h-3.5 opacity-50" />
                </button>
              ))}
            </div>
          </div>
        )}

        {searched && !loading && total === 0 && !error && (
          <div className="py-20 text-center">
            <p className="font-serif text-5xl">Nothing matched.</p>
            <p className="text-text-muted mt-3">Check the spelling or use fewer words. Small typos are handled automatically.</p>
          </div>
        )}

        {searched && total > 0 && (
          <>
            {results.genres.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mb-10">
                <span className="label mr-2">Genres</span>
                {results.genres.map((g) => (
                  <Link key={g.name} to={`/explore?genre=${encodeURIComponent(g.name)}`} className="h-9 px-4 rounded-full border border-border text-[13px] inline-flex items-center gap-2 hover:bg-text-main hover:text-bg-base transition-colors">
                    {g.name} <span className="opacity-50 text-[11px]">{g.book_count}</span>
                  </Link>
                ))}
              </div>
            )}

            <Tabs
              tabs={[
                { id: 'books', label: 'Books', count: results.books.length },
                { id: 'authors', label: 'Authors', count: results.authors.length },
              ]}
              active={tab}
              onChange={setTab}
            />

            {tab === 'books' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-12">
                {results.books.map((b, i) => (
                  <motion.div key={b.book_id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: Math.min(i, 12) * 0.03 }}>
                    <BookCard book={b} source="search" />
                  </motion.div>
                ))}
                {!results.books.length && <p className="label col-span-full">No books, but see the authors tab.</p>}
              </div>
            )}

            {tab === 'authors' && (
              <div className="border-t border-border">
                {results.authors.map((a) => (
                  <AuthorRow key={a.name} author={a} onToggle={toggleFollow} busy={busy[a.name]} signedIn={!!currentUser} />
                ))}
                {!results.authors.length && <p className="label py-6">No matching authors.</p>}
              </div>
            )}
          </>
        )}
      </div>
    </Page>
  );
};

export default SearchPage;
