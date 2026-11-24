import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, RotateCcw, Share2 } from 'lucide-react';
import BookCard from '../components/BookCard';
import NeoButton, { cn } from '../components/NeoButton';
import { CoverImage, EASE } from '../components/ui';
import { DogEar } from '../components/Dogs';
import { useAuth } from '../contexts/AuthContext';
import { browseBooks, setFavouriteGenres } from '../services/api';

/*
  "What is your reader profile?" Five questions; every answer nudges genre
  scores and browse filters. The result is a named profile plus real books
  pulled from the catalogue with those filters.
*/
const QUESTIONS = [
  {
    q: 'Pick a mood for tonight',
    a: [
      { t: 'Cosy & warm', e: '☕', g: { Romance: 3, Humor: 2, 'Literary Fiction': 1 }, tag: 'cosy' },
      { t: 'Heart racing', e: '🔪', g: { Thriller: 3, Mystery: 2, Horror: 2 }, tag: 'thrill' },
      { t: 'Curious mind', e: '🔭', g: { Science: 3, History: 2, Philosophy: 2 }, tag: 'curious' },
      { t: 'Far, far away', e: '🐉', g: { Fantasy: 3, 'Science Fiction': 2, Mythology: 1 }, tag: 'dreamy' },
    ],
  },
  {
    q: 'How long should it be?',
    a: [
      { t: 'A short sprint', e: '⚡', f: { max_pages: 200 } },
      { t: 'An evening or two', e: '🌙', f: { max_pages: 300 } },
      { t: 'A proper journey', e: '🧭', f: { max_pages: 450 } },
      { t: 'Doorstoppers welcome', e: '🧱', f: {} },
    ],
  },
  {
    q: 'Which era calls you?',
    a: [
      { t: 'Dusty classics', e: '🕯️', g: { Classic: 3, Gothic: 1, Poetry: 1 }, f: { decade: 1900 }, tag: 'classic' },
      { t: 'Mid-century', e: '📻', g: { 'Literary Fiction': 1, 'Detective Fiction': 2 }, f: { decade: 1960 } },
      { t: 'Modern favourites', e: '📚', f: { decade: 2000 } },
      { t: 'Fresh off the press', e: '✨', g: { 'Young Adult': 1 }, f: { decade: 2010 }, tag: 'fresh' },
    ],
  },
  {
    q: 'Where do you read best?',
    a: [
      { t: 'In bed at midnight', e: '🛏️', g: { Horror: 1, Paranormal: 1 }, tag: 'night' },
      { t: 'On the commute', e: '🚆', g: { 'Short Stories': 2, Essays: 1 }, tag: 'commute' },
      { t: 'A café corner', e: '🥐', g: { Memoir: 1, 'World Literature': 2 }, tag: 'cafe' },
      { t: 'Outdoors, sun out', e: '🌿', g: { Adventure: 2, Nature: 2, Travel: 1 }, tag: 'outdoor' },
    ],
  },
  {
    q: 'How picky are you?',
    a: [
      { t: 'Only the acclaimed', e: '🏆', f: { min_rating: 4, sort: 'rating' } },
      { t: 'Crowd favourites', e: '🔥', f: { sort: 'popular' } },
      { t: 'Hidden gems', e: '💎', f: { min_rating: 3.8, sort: 'rating', gem: true } },
      { t: 'Surprise me', e: '🎲', f: { sort: 'popular', random: true } },
    ],
  },
];

const PROFILES = {
  cosy: ['The Hearth Reader', 'You read to feel at home. Warm characters, soft endings and a mug within reach.'],
  thrill: ['The Midnight Detective', 'You turn pages like clues. A twist is the best kind of nightcap.'],
  curious: ['The Explorer of Ideas', 'Every book is a question you want answered. You finish with notes in the margins.'],
  dreamy: ['The World Builder', 'Maps on the endpapers, magic in the rules. You read to live somewhere else for a while.'],
};
const FLAVOUR = {
  night: 'after dark', commute: 'on the move', cafe: 'with a coffee', outdoor: 'in the open air', classic: 'with an old soul', fresh: 'ahead of the curve',
};

const floating = Array.from({ length: 10 }, (_, i) => ({ x: (i * 37) % 100, d: 14 + (i % 4) * 4, r: (i % 2 ? 1 : -1) * (6 + (i % 3) * 4), delay: i * 1.3 }));

const QuizPage = () => {
  const { currentUser } = useAuth();
  const [step, setStep] = useState(-1); // -1 intro, 0..n-1 questions, n result
  const [answers, setAnswers] = useState([]);
  const [books, setBooks] = useState(null);
  const [deco, setDeco] = useState([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { browseBooks({ sort: 'rating', limit: 10, offset: 40 }).then((r) => setDeco(r.books)).catch(() => {}); }, []);

  const result = useMemo(() => {
    if (answers.length < QUESTIONS.length) return null;
    const scores = {};
    const filters = {};
    const tags = [];
    answers.forEach((ai, qi) => {
      const a = QUESTIONS[qi].a[ai];
      Object.entries(a.g || {}).forEach(([g, w]) => { scores[g] = (scores[g] || 0) + w; });
      Object.assign(filters, a.f || {});
      if (a.tag) tags.push(a.tag);
    });
    const top = Object.entries(scores).sort((x, y) => y[1] - x[1]).map(([g]) => g).slice(0, 3);
    const [name, blurb] = PROFILES[tags[0]] || PROFILES.dreamy;
    const flavour = tags.slice(1).map((t) => FLAVOUR[t]).filter(Boolean)[0];
    return { name, blurb, flavour, top, filters };
  }, [answers]);

  useEffect(() => {
    if (!result) return;
    setBooks(null);
    const { filters, top } = result;
    const base = { sort: filters.sort || 'popular', min_rating: filters.min_rating, max_pages: filters.max_pages, decade: filters.decade, limit: 6 };
    const offset = filters.gem ? 30 : filters.random ? Math.floor(Math.random() * 60) : 0;
    // Try strict filters first, then relax era and length so there are always picks
    const attempt = (params) => Promise.all(top.map((g) => browseBooks({ ...params, genre: g, offset }).then((r) => r.books).catch(() => [])));
    (async () => {
      let lists = await attempt(base);
      if (lists.flat().length < 6) lists = await attempt({ ...base, decade: undefined });
      if (lists.flat().length < 6) lists = await attempt({ sort: base.sort, limit: 6 });
      const seen = new Set();
      const merged = [];
      for (let i = 0; i < 6; i += 1) lists.forEach((l) => { const b = l[i]; if (b && !seen.has(b.book_id)) { seen.add(b.book_id); merged.push(b); } });
      setBooks(merged.slice(0, 10));
    })();
  }, [result]);

  const choose = (i) => {
    const next = [...answers.slice(0, step), i];
    setAnswers(next);
    setTimeout(() => setStep(step + 1), 260);
  };
  const restart = () => { setAnswers([]); setBooks(null); setSaved(false); setStep(0); };
  const save = async () => { await setFavouriteGenres(result.top); setSaved(true); };
  const share = async () => {
    try { await navigator.clipboard.writeText(`I'm "${result.name}" on BookLog. Top shelves: ${result.top.join(', ')}. ${window.location.origin}/quiz`); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };
  const progress = step < 0 ? 0 : Math.min(1, step / QUESTIONS.length);

  return (
    <div className="relative min-h-[calc(100vh-96px)] overflow-hidden">
      {/* covers drifting up the sides, like loose pages */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {deco.slice(0, 10).map((b, i) => (
          <motion.div
            key={b.book_id}
            className="absolute w-[90px] md:w-[120px] aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover opacity-80"
            style={{ left: `${i % 2 ? 84 + (i % 3) * 4 : 2 + (i % 3) * 4}%` }}
            initial={{ y: '110vh', rotate: floating[i].r }}
            animate={{ y: '-30vh', rotate: -floating[i].r }}
            transition={{ duration: floating[i].d, repeat: Infinity, ease: 'linear', delay: floating[i].delay }}
          >
            <CoverImage book={b} />
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-3xl mx-auto px-5 py-10 md:py-16 min-h-[calc(100vh-96px)] flex flex-col">
        {step >= 0 && step < QUESTIONS.length && (
          <div className="flex items-center gap-4 mb-10">
            <button onClick={() => setStep(Math.max(-1, step - 1))} className="w-10 h-10 rounded-full border border-border flex items-center justify-center" aria-label="Back"><ArrowLeft className="w-4 h-4" /></button>
            <div className="flex-1 h-[3px] bg-border rounded-full overflow-hidden">
              <motion.div className="h-full bg-accent-red" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.6, ease: EASE }} />
            </div>
            <span className="label tabular-nums">{step + 1} / {QUESTIONS.length}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === -1 && (
            <motion.div key="intro" className="flex-1 flex flex-col items-center justify-center text-center" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} transition={{ duration: 0.6, ease: EASE }}>
              <DogEar animal="owl" cover="#E33529" seed={17} body={false} ribbon={false} className="w-40 sm:w-48 mb-2" />
              <p className="caps">BookLog quiz</p>
              <h1 className="font-display text-[clamp(3.6rem,9vw,7.5rem)] mt-3">What is your <br />reader profile?</h1>
              <p className="caps mt-5 max-w-md leading-snug">Five quick questions, from mood to era. We’ll match you with a profile and real books from the catalogue.</p>
              <button onClick={() => setStep(0)} className="mt-10 h-14 px-9 rounded-full bg-red text-[#FBFBF4] font-display text-[26px] inline-flex items-center gap-2 hover:-rotate-3 hover:scale-105 transition-transform duration-500">
                Start quiz <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step >= 0 && step < QUESTIONS.length && (
            <motion.div key={`q${step}`} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.5, ease: EASE }}>
              <h2 className="font-display text-[clamp(2.6rem,6vw,5rem)] text-center">{QUESTIONS[step].q}</h2>
              <div className="grid sm:grid-cols-2 gap-3 mt-10">
                {QUESTIONS[step].a.map((a, i) => (
                  <motion.button
                    key={a.t}
                    onClick={() => choose(i)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * i, duration: 0.5, ease: EASE }}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.97 }}
                    className={cn('group h-28 rounded-[22px] border px-6 flex items-center gap-5 text-left transition-colors',
                      answers[step] === i ? 'bg-espresso text-latte border-espresso' : 'bg-surface-white/80 backdrop-blur border-border hover:border-text-main')}
                  >
                    <span className="text-[2.2rem] transition-transform duration-500 group-hover:scale-125 group-hover:-rotate-6">{a.e}</span>
                    <span className="font-wide font-semibold text-[22px] leading-none">{a.t}</span>
                    {answers[step] === i && <Check className="w-5 h-5 ml-auto" />}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {step === QUESTIONS.length && result && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: EASE }} className="w-full">
              <div className="rounded-[28px] bg-espresso text-latte p-8 md:p-12 relative overflow-hidden">
                <motion.span className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-accent-red/30 blur-3xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 6, repeat: Infinity }} />
                <p className="text-[12px] uppercase tracking-[0.14em] opacity-60 relative">Your reader profile</p>
                <h2 className="font-statement text-[clamp(2.8rem,8vw,6rem)] mt-3 relative">{result.name}</h2>
                {result.flavour && <p className="font-serif text-2xl text-sand relative">…{result.flavour}</p>}
                <p className="font-serif text-[1.35rem] leading-[1.35] mt-5 max-w-xl relative">{result.blurb}</p>
                <div className="flex flex-wrap gap-2 mt-6 relative">
                  {result.top.map((g) => <Link key={g} to={`/explore?genre=${encodeURIComponent(g)}`} className="h-9 px-4 rounded-full bg-latte/10 hover:bg-latte hover:text-espresso transition-colors text-[13px] flex items-center">{g}</Link>)}
                </div>
                <div className="flex flex-wrap gap-2 mt-8 relative">
                  {currentUser && <NeoButton variant="red" onClick={save} disabled={saved}>{saved ? <><Check className="w-4 h-4 mr-2" /> Saved to profile</> : 'Save as my favourite genres'}</NeoButton>}
                  <button onClick={share} className="h-11 px-5 rounded-full border border-latte/30 text-[13px] flex items-center gap-2 hover:bg-latte/10"><Share2 className="w-4 h-4" /> {copied ? 'Copied!' : 'Share result'}</button>
                  <button onClick={restart} className="h-11 px-5 rounded-full border border-latte/30 text-[13px] flex items-center gap-2 hover:bg-latte/10"><RotateCcw className="w-4 h-4" /> Retake</button>
                </div>
              </div>
              <p className="font-wide font-semibold text-[28px] mt-12 mb-6">Your first ten reads</p>
              {!books ? <p className="label">Pulling books from the shelves…</p> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-5 gap-y-10">
                  {books.map((b, i) => (
                    <motion.div key={b.book_id} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.6, ease: EASE }}>
                      <BookCard book={b} source="quiz" />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuizPage;
