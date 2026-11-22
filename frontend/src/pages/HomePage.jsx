import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BookOpen, MessageCircle, PenLine, Search, Users } from 'lucide-react';
import BookCard from '../components/BookCard';
import GoalWidget from '../components/GoalWidget';
import { cn } from '../components/NeoButton';
import { Avatar, CountUp, CoverImage, EASE, FadeIn, timeAgo } from '../components/ui';
import { OnlineDot } from '../components/social';
import { Stage, StageMobile, VelocityRow, bookPath, pad, useIsDesktop } from '../components/Stage';
import { useAuth } from '../contexts/AuthContext';
import {
  browseBooks, browseLists, getBookOfTheDay, getCatalogueStats, getFeaturedAuthors, getGenreIndex, getJournal,
  getPersonalizedRecommendations, getRandomBook, getReadingNow, getTrending,
} from '../services/api';

/** Pill button + round arrow, the site's signature call to action. */
export const PillCTA = ({ to, onClick, children, tone = 'light', arrow = 'dark' }) => {
  const inner = (
    <span className="group inline-flex items-center gap-1.5">
      <span className={cn('h-12 px-6 rounded-full inline-flex items-center text-[14px] font-medium transition-colors duration-300',
        tone === 'light' ? 'bg-cream text-espresso group-hover:bg-latte' : tone === 'latte' ? 'bg-latte text-espresso group-hover:bg-sand' : 'bg-espresso text-latte group-hover:bg-cocoa')}
      >{children}</span>
      <span className={cn('w-12 h-12 rounded-full inline-flex items-center justify-center overflow-hidden relative transition-transform duration-500 group-hover:rotate-[-45deg]',
        arrow === 'dark' ? 'bg-espresso text-latte' : arrow === 'mustard' ? 'bg-mustard text-espresso' : arrow === 'red' ? 'bg-accent-red text-white' : 'bg-cream text-espresso')}
      >
        <ArrowRight className="w-4 h-4" />
      </span>
    </span>
  );
  return to ? <Link to={to}>{inner}</Link> : <button onClick={onClick}>{inner}</button>;
};

// =====================================================================
// HERO: full-bleed slides over a moving wall of covers
// =====================================================================
const WallColumn = ({ books, duration, reverse }) => (
  <div className="overflow-hidden h-full">
    <div className="flex flex-col gap-3" style={{ animation: `wall ${duration}s linear infinite${reverse ? ' reverse' : ''}` }}>
      {[...books, ...books].map((b, i) => (
        <div key={`${b.book_id}-${i}`} className="aspect-[2/3] rounded-[4px] overflow-hidden shrink-0"><CoverImage book={b} eager={i < 4} /></div>
      ))}
    </div>
  </div>
);

const CoverWall = ({ books, cols = 8 }) => (
  <div className="absolute inset-[-20%] [perspective:1400px]">
    <div className="absolute inset-0 grid gap-3 [transform:rotateX(24deg)_rotateZ(-10deg)]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {Array.from({ length: cols }, (_, c) => (
        <WallColumn key={c} books={books.filter((_, i) => i % cols === c)} duration={60 + (c % 3) * 15} reverse={c % 2 === 1} />
      ))}
    </div>
  </div>
);

const SLIDES = [
  { title: ['A diary for', 'every book.'], short: 'A diary for every book', sort: 'popular' },
  { title: ['Twenty thousand', 'stories, one shelf.'], short: 'The catalogue', sort: 'rating' },
  { title: ['Readers who', 'read like you.'], short: 'Readers like you', sort: 'newest' },
];

const Hero = ({ walls, today, stats }) => {
  const [i, setI] = useState(0);
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
  useEffect(() => {
    const id = setTimeout(() => setI((n) => (n + 1) % SLIDES.length), 7000);
    return () => clearTimeout(id);
  }, [i]);
  const slide = SLIDES[i];
  const wall = walls[i] || walls[0] || [];
  const thumbs = walls.map((w) => w[3] || w[0]);

  return (
    <section ref={ref} className="relative h-[100svh] min-h-[640px] overflow-hidden bg-roast text-latte">
      <motion.div className="absolute inset-0" style={{ y }}>
        <AnimatePresence initial={false}>
          <motion.div
            key={i}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.12 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 1.4 }, scale: { duration: 8, ease: 'linear' } }}
          >
            {wall.length > 0 && <CoverWall books={wall} />}
          </motion.div>
        </AnimatePresence>
      </motion.div>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(26,16,12,0.62)_0%,rgba(26,16,12,0.45)_40%,rgba(26,16,12,0.94)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_80%,rgba(26,16,12,0.6),transparent_60%)]" />

      {/* Right: stacked cards */}
      <div className="absolute right-4 sm:right-6 top-[24%] hidden md:flex flex-col gap-3 w-[300px] lg:w-[340px]">
        <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9, duration: 1, ease: EASE }}>
          <Link to="/explore" className="group flex items-center justify-between h-12 px-5 rounded-[14px] bg-espresso/70 backdrop-blur-xl text-[14px] hover:bg-espresso transition-colors">
            Explore the catalogue <ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" />
          </Link>
        </motion.div>
        <div className="grid grid-cols-2 gap-3">
          {today && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05, duration: 1, ease: EASE }}>
              <Link to={bookPath(today)} className="group block rounded-[14px] bg-espresso/70 backdrop-blur-xl p-3 h-full hover:bg-espresso transition-colors">
                <div className="aspect-[4/5] rounded-[8px] bg-cocoa flex items-center justify-center overflow-hidden">
                  <div className="w-[62%] aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-3"><CoverImage book={today} eager /></div>
                </div>
                <p className="text-[12px] mt-2.5 leading-tight">Book of the day</p>
              </Link>
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 1, ease: EASE }}>
            <Link to="/reels" className="group block rounded-[14px] overflow-hidden relative h-full min-h-[190px]">
              {wall[7] && <span className="absolute inset-0 scale-110 transition-transform duration-[1.5s] group-hover:scale-125"><CoverImage book={wall[7]} /></span>}
              <span className="absolute inset-0 bg-gradient-to-t from-roast/90 via-roast/20 to-transparent" />
              <span className="absolute left-3 bottom-3 text-[12px]">Book reels</span>
              <span className="absolute right-3 top-3 w-8 h-8 rounded-full bg-cream/90 text-espresso flex items-center justify-center"><ArrowUpRight className="w-4 h-4" /></span>
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Title */}
      <div className="absolute left-4 sm:left-6 lg:left-8 bottom-[150px] sm:bottom-[170px] right-4">
        <AnimatePresence mode="wait">
          <motion.h1 key={i} className="font-serif text-sand text-[clamp(3rem,8.4vw,8.5rem)] leading-[0.95] tracking-[-0.035em]">
            {slide.title.map((line, li) => (
              <span key={line} className="block overflow-hidden pb-[0.06em]">
                <motion.span
                  className="block"
                  initial={{ y: '105%' }}
                  animate={{ y: '0%' }}
                  exit={{ y: '-105%', transition: { duration: 0.6, ease: [0.76, 0, 0.24, 1], delay: li * 0.05 } }}
                  transition={{ duration: 1.1, ease: EASE, delay: 0.15 + li * 0.1 }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </motion.h1>
        </AnimatePresence>
      </div>

      {/* Slide index with thumbnails and running lines */}
      <div className="absolute left-4 sm:left-6 lg:left-8 right-4 sm:right-6 bottom-6 grid grid-cols-3 gap-3 sm:gap-6">
        {SLIDES.map((s, n) => (
          <button key={s.short} onClick={() => setI(n)} className="text-left group">
            <span className="block h-px bg-latte/25 relative overflow-hidden mb-3">
              {n === i && <motion.span key={`line-${i}`} className="absolute inset-y-0 left-0 bg-latte" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 7, ease: 'linear' }} />}
              {n < i && <span className="absolute inset-0 bg-latte/70" />}
            </span>
            <span className="flex items-start gap-3">
              <span className={cn('hidden sm:block w-[72px] h-[48px] rounded-[6px] overflow-hidden shrink-0 transition-opacity', n === i ? 'opacity-100' : 'opacity-50 group-hover:opacity-80')}>
                {thumbs[n] && <span className="block w-full h-full scale-150"><CoverImage book={thumbs[n]} /></span>}
              </span>
              <span className={cn('text-[12px] leading-tight transition-opacity', n === i ? 'opacity-100' : 'opacity-50 group-hover:opacity-80')}>
                <span className="block tabular-nums">{pad(n + 1)}</span>
                <span className="block mt-1.5">{s.short}</span>
              </span>
            </span>
          </button>
        ))}
      </div>

      {stats && (
        <div className="absolute left-4 sm:left-6 lg:left-8 top-[24%] hidden lg:block text-[12px] leading-[1.6] opacity-80">
          <p><span className="tabular-nums"><CountUp value={stats.books} /></span> books</p>
          <p><span className="tabular-nums"><CountUp value={stats.authors} /></span> authors</p>
          <p><span className="tabular-nums"><CountUp value={stats.genres} /></span> genres</p>
        </div>
      )}
    </section>
  );
};

// =====================================================================
// GENRE TILES: coloured blocks with fanned covers, drag to scroll
// =====================================================================
const TILE_COLOURS = ['#F2B530', '#2B7B1E', '#D9B8A0', '#004438', '#3C0755', '#0762A3', '#940047', '#CE5E16', '#296D10', '#002988', '#BE9A83', '#1F4D3F'];
const GenreTiles = ({ genres }) => {
  const ref = useRef(null);
  const drag = useRef(null);
  if (!genres.length) return null;
  return (
    <section className="bg-espresso py-4 -mt-px">
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-2 cursor-grab active:cursor-grabbing select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-lenis-prevent
        onPointerDown={(e) => { drag.current = { x: e.clientX, s: ref.current.scrollLeft, moved: false }; }}
        onPointerMove={(e) => { if (drag.current) { const dx = e.clientX - drag.current.x; if (Math.abs(dx) > 4) drag.current.moved = true; ref.current.scrollLeft = drag.current.s - dx; } }}
        onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
        onPointerLeave={() => { drag.current = null; }}
        onClickCapture={(e) => { if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); } }}
      >
        {genres.slice(0, 16).map((g, i) => {
          const bg = TILE_COLOURS[i % TILE_COLOURS.length];
          const light = ['#F2B530', '#D9B8A0', '#BE9A83'].includes(bg);
          return (
            <motion.div key={g.name} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: (i % 6) * 0.06 }}>
              <Link
                to={`/explore?genre=${encodeURIComponent(g.name)}`}
                draggable={false}
                className="group relative block w-[280px] sm:w-[340px] h-[230px] rounded-[14px] overflow-hidden shrink-0"
                style={{ background: bg, color: light ? '#2B1B14' : '#FCF3ED' }}
              >
                <div className="absolute inset-x-0 top-5 bottom-14 flex items-center justify-center">
                  {(g.covers || []).slice(0, 3).map((c, k) => (
                    <img
                      key={c}
                      src={c}
                      alt=""
                      draggable={false}
                      className="absolute h-[150px] aspect-[2/3] object-cover rounded-[3px] shadow-[0_18px_30px_-10px_rgba(0,0,0,0.5)] transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{ transform: `translateX(${(k - 1) * 46}px) rotate(${(k - 1) * 8}deg)`, zIndex: k === 1 ? 3 : 1 }}
                    />
                  ))}
                  <span className="absolute inset-0 transition-transform duration-700 group-hover:scale-105" />
                </div>
                <div className="absolute left-4 right-4 bottom-3 flex items-end justify-between">
                  <span className="font-wide font-semibold text-[24px] leading-none">{g.name}</span>
                  <span className="text-[11px] opacity-70 tabular-nums">{g.book_count} books</span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};

// =====================================================================
// STATEMENT: giant condensed caps + old covers floating on curved lines
// =====================================================================
const Floating = ({ book, x, y, w, rot, speed, frame }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const ty = useTransform(scrollYProgress, [0, 1], [speed * 80, -speed * 80]);
  const r = useTransform(scrollYProgress, [0, 1], [rot - 4, rot + 4]);
  return (
    <motion.div ref={ref} className="absolute" style={{ left: `${x}%`, top: `${y}%`, width: w, y: ty, rotate: r }}>
      <Link to={bookPath(book)} data-cursor="Open" className={cn('block shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] transition-transform duration-500 hover:scale-110 hover:z-10', frame && 'bg-[#F6EBDD] p-2 pb-3 rounded-[3px]')}>
        <span className="block aspect-[2/3] overflow-hidden rounded-[2px] sepia-[0.35] hover:sepia-0 transition-[filter] duration-700"><CoverImage book={book} /></span>
      </Link>
    </motion.div>
  );
};

const SPOTS = [
  [4, 6, 150, -6, 1, true], [18, 46, 110, 4, 1.6, false], [8, 74, 130, 3, 0.8, true], [30, 82, 120, -5, 1.3, false],
  [72, 8, 120, 6, 1.4, true], [86, 30, 140, -3, 0.9, false], [78, 64, 160, 5, 1.2, true], [58, 86, 110, -7, 1.7, false],
  [44, 60, 96, 3, 2, false],
];

const Statement = ({ stats, oldBooks }) => (
  <section className="relative bg-espresso text-latte overflow-hidden py-28 md:py-40 min-h-[120vh]">
    {/* curved guide lines */}
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
      {['M-50 300 C 250 420, 300 700, 520 1050', 'M1050 150 C 800 300, 760 600, 420 1050', 'M-50 820 C 300 640, 700 640, 1050 860'].map((d, i) => (
        <motion.path key={d} d={d} fill="none" stroke="rgba(237,209,189,0.18)" strokeWidth="1" vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2.4, ease: EASE, delay: i * 0.3 }} />
      ))}
    </svg>
    <div className="absolute inset-0 hidden md:block">
      {oldBooks.slice(0, SPOTS.length).map((b, i) => {
        const [x, y, w, rot, speed, frame] = SPOTS[i];
        return <Floating key={b.book_id} book={b} x={x} y={y} w={w} rot={rot} speed={speed} frame={frame} />;
      })}
    </div>
    <div className="relative max-w-5xl mx-auto px-5 text-center">
      <FadeIn>
        <h2 className="font-statement text-latte text-[clamp(3.2rem,10vw,9.5rem)]">
          Since {stats?.decades?.[0]?.decade || 1800},<br />
          books <span className="font-serif normal-case font-light text-[0.45em] align-middle tracking-[-0.02em] mx-1">that</span> awaken<br />
          stories
        </h2>
      </FadeIn>
      <FadeIn delay={0.15} className="mt-10 flex justify-center">
        <PillCTA to="/explore?sort=oldest" tone="latte" arrow="cream">From the oldest shelf</PillCTA>
      </FadeIn>
      <FadeIn delay={0.25}>
        <p className="text-[clamp(1.1rem,1.6vw,1.4rem)] leading-[1.45] max-w-xl mx-auto mt-10 text-latte/85">
          BookLog began as a class project with a simple idea: every book you read deserves a line in a diary.
          Today it holds {stats ? stats.books.toLocaleString() : 'thousands of'} books across {stats?.genres || 'dozens of'} genres,
          kept honest by PostgreSQL, connected by Neo4j and remembered by MongoDB.
        </p>
      </FadeIn>
      {stats && (
        <div className="grid grid-cols-3 gap-6 mt-16 max-w-2xl mx-auto border-t border-latte/15 pt-6">
          {[['Books', stats.books], ['Authors', stats.authors], ['Pages', stats.pages]].map(([k, v]) => (
            <div key={k}>
              <p className="font-statement text-[clamp(1.8rem,3.6vw,3rem)] tabular-nums"><CountUp value={v} /></p>
              <p className="text-[12px] opacity-60 mt-1">{k}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  </section>
);

// =====================================================================
// JOURNEY OF A BOOK: a wavy line that draws as you scroll
// =====================================================================
const STOPS = [
  { icon: Search, t: 'Discover', d: 'Search 20k+ books with typos allowed, or swipe through reels.', x: 12, y: 62 },
  { icon: PenLine, t: 'Log', d: 'Rate, review and date every read. Triggers keep the counts true.', x: 36, y: 30 },
  { icon: MessageCircle, t: 'Share', d: 'Send books in messages, post takes only followers can see.', x: 62, y: 66 },
  { icon: Users, t: 'Connect', d: 'Follow readers, see taste match, and who is reading what now.', x: 86, y: 34 },
];

const Journey = ({ bg }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.6'] });
  const draw = useSpring(useTransform(scrollYProgress, [0, 1], [0, 1]), { stiffness: 60, damping: 20 });
  return (
    <section ref={ref} className="relative bg-roast text-latte overflow-hidden min-h-[100vh] py-24">
      {bg.length > 0 && <div className="absolute inset-0 opacity-40"><CoverWall books={bg} cols={7} /></div>}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(26,16,12,0.55),rgba(26,16,12,0.95)_75%)]" />
      <div className="relative text-center px-5">
        <FadeIn>
          <h2 className="font-statement text-[clamp(2.8rem,8vw,7.5rem)]">
            The journey <span className="font-serif normal-case font-light text-[0.45em] align-middle mx-1">of a</span> book
          </h2>
        </FadeIn>
      </div>
      <div className="relative mx-auto max-w-[1300px] h-[520px] mt-6 hidden md:block">
        <svg viewBox="0 0 1000 400" className="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden="true">
          <path d="M40 300 C 160 300, 200 80, 360 120 S 520 340, 620 270 S 780 40, 960 140" fill="none" stroke="rgba(237,209,189,0.12)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <motion.path d="M40 300 C 160 300, 200 80, 360 120 S 520 340, 620 270 S 780 40, 960 140" fill="none" stroke="#EDD1BD" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ pathLength: draw }} />
        </svg>
        {STOPS.map(({ icon: Icon, t, d, x, y }, i) => (
          <motion.div key={t} className="absolute -translate-x-1/2 -translate-y-1/2 w-[230px] text-center" style={{ left: `${x}%`, top: `${y}%` }}
            initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: '-15%' }} transition={{ duration: 0.8, ease: EASE, delay: i * 0.25 }}>
            <span className="mx-auto w-20 h-20 rounded-full border border-latte/30 bg-espresso/70 backdrop-blur flex items-center justify-center"><Icon className="w-8 h-8" strokeWidth={1.2} /></span>
            <p className="font-wide font-semibold text-[24px] mt-4">{t}</p>
            <p className="text-[13px] opacity-70 mt-1 leading-snug">{d}</p>
          </motion.div>
        ))}
      </div>
      <div className="relative md:hidden px-5 mt-10 space-y-8">
        {STOPS.map(({ icon: Icon, t, d }) => (
          <div key={t} className="flex gap-4 items-start">
            <span className="w-14 h-14 rounded-full border border-latte/30 flex items-center justify-center shrink-0"><Icon className="w-6 h-6" strokeWidth={1.3} /></span>
            <div><p className="font-wide font-semibold text-[22px]">{t}</p><p className="text-[13px] opacity-70">{d}</p></div>
          </div>
        ))}
      </div>
      <div className="relative text-center px-5 mt-6">
        <p className="text-[clamp(1.05rem,1.5vw,1.3rem)] leading-[1.45] max-w-xl mx-auto text-latte/85">A book begins on a shelf, finds its reader in a search, lives on in a review and travels on through a friend.</p>
        <div className="mt-8 flex justify-center"><PillCTA to="/reels" tone="latte" arrow="red">Start with reels</PillCTA></div>
      </div>
    </section>
  );
};

// =====================================================================
// AUTHORS strip + "A for Authors"
// =====================================================================
const Authors = ({ authors }) => {
  if (!authors.length) return null;
  const row = [...authors, ...authors];
  return (
    <section className="bg-espresso text-latte py-16 overflow-hidden">
      <div className="marquee">
        <div className="marquee-track flex gap-4 w-max" style={{ animationDuration: '70s' }}>
          {row.map((a, i) => (
            <Link key={`${a.name}-${i}`} to={`/author/${encodeURIComponent(a.name)}`} className="group relative w-[200px] sm:w-[230px] aspect-[4/5] rounded-[12px] overflow-hidden shrink-0 bg-cocoa">
              <img src={a.photo_url} alt={a.name} loading="lazy" className="w-full h-full object-cover grayscale-[0.4] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700" />
              <span className="absolute inset-0 bg-gradient-to-t from-roast/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="absolute left-3 right-3 bottom-3 translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                <span className="block font-wide font-semibold text-[18px] leading-none">{a.name}</span>
                <span className="block text-[11px] opacity-70 mt-1">{a.books} books · ★ {Number(a.avg_rating).toFixed(1)}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
      <div className="text-center px-5 mt-20">
        <FadeIn><h2 className="font-statement text-[clamp(3rem,9vw,8rem)]">A <span className="font-serif normal-case font-light text-[0.5em] align-middle mx-1">for</span> Authors</h2></FadeIn>
        <FadeIn delay={0.15}><p className="text-[clamp(1.05rem,1.5vw,1.3rem)] leading-[1.45] max-w-xl mx-auto mt-6 text-latte/85">Thousands of writers with bios and portraits. Follow the ones you love and their books start shaping your picks.</p></FadeIn>
        <FadeIn delay={0.25} className="mt-8 flex justify-center"><PillCTA to="/search" tone="latte" arrow="red">Find an author</PillCTA></FadeIn>
      </div>
    </section>
  );
};

// =====================================================================
// READING NOW (signed in): what the people you follow are reading
// =====================================================================
const ReadingNow = ({ items, recs }) => (
  <section className="px-4 sm:px-6 lg:px-8 py-24">
    <div className="grid lg:grid-cols-12 gap-10">
      <div className="lg:col-span-4">
        <p className="text-[13px] font-medium">Your circle</p>
        <h2 className="font-serif text-[clamp(2.6rem,5vw,4.6rem)] leading-[0.95] mt-2">Reading now, <br />right now.</h2>
        <p className="text-text-muted mt-4 max-w-sm">What the readers you follow have on their nightstand. Green means they’re online, so say hi.</p>
        <div className="mt-8"><GoalWidget /></div>
      </div>
      <div className="lg:col-span-8">
        {items.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-border p-10 text-center">
            <p className="font-serif text-3xl">Nobody you follow is mid-book.</p>
            <p className="text-text-muted mt-2">Follow a few readers and their current reads appear here.</p>
            <div className="mt-6 flex justify-center"><PillCTA to="/people" tone="dark" arrow="red">Find readers</PillCTA></div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {items.slice(0, 6).map((r, i) => (
              <motion.div key={`${r.username}-${r.book_id}`} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.7, ease: EASE }}
                className="group flex gap-4 p-4 rounded-[20px] bg-surface-white border border-border hover:border-text-main transition-colors">
                <Link to={bookPath(r)} className="w-20 aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover shrink-0 transition-transform duration-500 group-hover:-rotate-3"><CoverImage book={r} /></Link>
                <div className="min-w-0 flex-1 flex flex-col">
                  <Link to={`/u/${r.username}`} className="flex items-center gap-2">
                    <span className="relative"><Avatar username={r.username} size="w-7 h-7 text-xs" /><OnlineDot on={r.online} className="w-2.5 h-2.5" /></span>
                    <span className="text-[13px] font-medium">@{r.username}</span>
                  </Link>
                  <Link to={bookPath(r)} className="font-serif text-[1.35rem] leading-tight mt-2 line-clamp-2 hover:text-accent-red transition-colors">{r.title}</Link>
                  <p className="text-[12px] text-text-muted mt-1">since {timeAgo(r.since)}</p>
                  <Link to={`/messages/${r.username}`} className="mt-auto self-start inline-flex items-center gap-1.5 text-[12px] font-medium pt-3 hover:text-accent-red"><MessageCircle className="w-3.5 h-3.5" /> Ask how it’s going</Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
        {recs.length > 0 && (
          <>
            <p className="text-[13px] font-medium mt-14 mb-5">Picked for you, with reasons</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-10">
              {recs.slice(0, 4).map((b) => <BookCard key={b.book_id} book={b} source={`recommendation:${b.source}`} />)}
            </div>
          </>
        )}
      </div>
    </div>
  </section>
);

// =====================================================================
// CULTURE OF READING (cream) + strip of covers
// =====================================================================
const Culture = ({ strip, trending }) => (
  <section className="bg-bg-base">
    <div className="flex gap-3 overflow-hidden px-4 sm:px-6 lg:px-8 pt-4">
      {strip.slice(0, 8).map((b, i) => (
        <motion.div key={b.book_id} className="shrink-0 w-[min(32vw,260px)] aspect-[4/3] rounded-[12px] overflow-hidden relative" initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.8, ease: EASE }}>
          <Link to={bookPath(b)} className="group block w-full h-full">
            <span className="absolute inset-0 scale-[1.6] blur-[1px] opacity-90 transition-transform duration-[1.5s] group-hover:scale-[1.8]"><CoverImage book={b} /></span>
            <span className="absolute inset-0 bg-espresso/10" />
          </Link>
        </motion.div>
      ))}
    </div>
    <div className="px-4 sm:px-6 lg:px-8 py-20 md:py-28 grid md:grid-cols-12 gap-10">
      <div className="md:col-span-7">
        <FadeIn><h2 className="font-serif text-[clamp(2.8rem,6vw,5.4rem)] leading-[0.95]">The culture <br />of reading</h2></FadeIn>
        <FadeIn delay={0.15}><p className="text-[17px] leading-[1.55] max-w-xl mt-10">
          Reading is a ritual: the chair, the lamp, the line you underline twice. BookLog keeps those rituals in one place,
          with a diary that remembers every book, reels that put one cover on your screen at a time, and messages for the friend who has to read it next.
        </p></FadeIn>
      </div>
      <div className="md:col-span-5 md:border-l md:border-border md:pl-10 flex flex-col gap-10">
        <div>
          <p className="font-serif text-[clamp(2rem,3.4vw,3rem)] leading-none">Trending this week</p>
          <p className="text-text-muted mt-2 text-[14px]">Most opened books, counted from MongoDB activity logs.</p>
          <div className="mt-5"><PillCTA to="/explore" tone="light" arrow="dark">Explore</PillCTA></div>
        </div>
        <div>
          <p className="font-serif text-[clamp(2rem,3.4vw,3rem)] leading-none">Year in books</p>
          <p className="text-text-muted mt-2 text-[14px]">Your reading, counted and charted from your diary.</p>
          <div className="mt-5"><PillCTA to="/library" tone="light" arrow="dark">Open my books</PillCTA></div>
        </div>
      </div>
    </div>
    {trending.length >= 6 && <div className="pb-16 overflow-hidden"><VelocityRow books={trending} base={-2} /></div>}
  </section>
);

// =====================================================================
// QUIZ teaser with covers drifting down
// =====================================================================
const QuizTeaser = ({ books }) => (
  <section className="relative bg-bg-base overflow-hidden min-h-[90vh] flex items-center justify-center">
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {books.slice(0, 8).map((b, i) => (
        <motion.div key={b.book_id} className="absolute w-[90px] md:w-[130px] aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover"
          style={{ left: `${i % 2 ? 78 + (i % 4) * 5 : 3 + (i % 4) * 5}%` }}
          initial={{ y: '-40vh', rotate: (i % 2 ? 1 : -1) * 12 }}
          animate={{ y: '120vh', rotate: (i % 2 ? -1 : 1) * 12 }}
          transition={{ duration: 16 + (i % 4) * 3, repeat: Infinity, ease: 'linear', delay: i * 2 }}>
          <CoverImage book={b} />
        </motion.div>
      ))}
    </div>
    <div className="relative text-center px-5">
      <p className="text-[14px] font-medium">BookLog Quiz</p>
      <FadeIn><h2 className="font-serif text-[clamp(2.6rem,6.5vw,5.6rem)] leading-[0.95] mt-3">What is your reader profile?</h2></FadeIn>
      <p className="text-[16px] text-text-muted mt-4">From mood to era, find out which shelves suit you best.</p>
      <div className="mt-10 flex justify-center"><PillCTA to="/quiz" tone="light" arrow="mustard">Start quiz</PillCTA></div>
    </div>
  </section>
);

// =====================================================================
// JOURNAL: latest reviews (falls back to popular lists)
// =====================================================================
const Journal = ({ reviews, lists }) => {
  const items = reviews.length
    ? reviews.map((r) => ({ key: `r${r.entry_id}`, href: bookPath(r), cover: r, title: `@${r.username} on ${r.title}`, text: r.review_text, tag: 'Review', date: r.created_at }))
    : lists.map((l) => ({ key: `l${l.list_id}`, href: `/lists/${l.list_id}`, cover: l.books?.[0] || (l.covers?.[0] ? { thumbnail: l.covers[0], title: l.name } : null), title: l.name, text: l.description, tag: 'List', date: l.created_at || l.updated_at }));
  if (!items.length) return null;
  return (
    <section className="bg-bg-base px-4 sm:px-6 lg:px-8 py-24 border-t border-border">
      <div className="grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-3">
          <h2 className="font-statement text-[clamp(3rem,6vw,5.5rem)]">Journal</h2>
          <p className="text-[15px] mt-4 max-w-xs">Stories of people, opinions and shelves, through the lens of reading.</p>
          <div className="mt-6"><PillCTA to={reviews.length ? '/feed' : '/lists'} tone="light" arrow="dark">Explore</PillCTA></div>
        </div>
        <div className="lg:col-span-9 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12">
          {items.slice(0, 6).map((it, i) => (
            <motion.div key={it.key} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.08, duration: 0.8, ease: EASE }}>
              <Link to={it.href} className="group block">
                <div className="aspect-[4/3] rounded-[10px] overflow-hidden bg-espresso relative">
                  {it.cover && <span className="absolute inset-0 scale-125 blur-[2px] opacity-60"><CoverImage book={it.cover} /></span>}
                  {it.cover && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[78%] aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover transition-transform duration-700 group-hover:scale-105 group-hover:-rotate-2"><CoverImage book={it.cover} /></span>}
                </div>
                <p className="text-[17px] leading-[1.3] mt-4 line-clamp-2 group-hover:text-accent-red transition-colors">{it.title}</p>
                {it.text && <p className="text-[13px] text-text-muted mt-1 line-clamp-2">{it.text}</p>}
                <p className="flex items-center gap-2 mt-3 text-[12px]">
                  <span className="h-7 px-3 rounded-full border border-text-main/40 inline-flex items-center">{it.tag}</span>
                  {it.date && <span className="text-text-muted">— {String(it.date).slice(0, 10)}</span>}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// PAGE
// =====================================================================
const HomePage = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const desktop = useIsDesktop();
  const [stats, setStats] = useState(null);
  const [walls, setWalls] = useState([]);
  const [today, setToday] = useState(null);
  const [genres, setGenres] = useState([]);
  const [oldBooks, setOldBooks] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [trending, setTrending] = useState([]);
  const [journal, setJournal] = useState([]);
  const [lists, setLists] = useState([]);
  const [reading, setReading] = useState([]);
  const [recs, setRecs] = useState([]);
  const [selected, setSelected] = useState([]);
  const [stageTotal, setStageTotal] = useState(null);
  const loadingMore = useRef(false);

  useEffect(() => {
    getCatalogueStats().then(setStats).catch(() => {});
    getBookOfTheDay().then(setToday).catch(() => {});
    getGenreIndex().then(setGenres).catch(() => {});
    getFeaturedAuthors(16).then(setAuthors).catch(() => {});
    getTrending(16).then(setTrending).catch(() => {});
    getJournal(6).then(setJournal).catch(() => {});
    browseLists('popular').then((l) => setLists(l.slice(0, 6))).catch(() => {});
    Promise.all(SLIDES.map((s) => browseBooks({ sort: s.sort, limit: 48 }).then((r) => r.books.filter((b) => b.thumbnail)).catch(() => [])))
      .then(setWalls);
    browseBooks({ sort: 'oldest', min_rating: 3.5, limit: 12 }).then((r) => setOldBooks(r.books)).catch(() => {});
    browseBooks({ sort: 'popular', limit: 20 }).then((r) => { setSelected(r.books); setStageTotal(r.total); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (authLoading || !currentUser) { setReading([]); setRecs([]); return; }
    getReadingNow().then(setReading).catch(() => {});
    getPersonalizedRecommendations().then(setRecs).catch(() => {});
  }, [currentUser, authLoading]);

  const loadMore = () => {
    if (loadingMore.current || selected.length >= 200 || (stageTotal !== null && selected.length >= stageTotal)) return;
    loadingMore.current = true;
    browseBooks({ sort: 'popular', limit: 20, offset: selected.length })
      .then((r) => setSelected((prev) => {
        const have = new Set(prev.map((b) => b.book_id));
        return [...prev, ...r.books.filter((b) => !have.has(b.book_id))];
      }))
      .catch(() => {})
      .finally(() => { loadingMore.current = false; });
  };
  const surprise = async () => { const b = await getRandomBook(); navigate(bookPath(b)); };

  return (
    <div className="overflow-x-clip">
      <Hero walls={walls} today={today} stats={stats} />
      <GenreTiles genres={genres} />
      <Statement stats={stats} oldBooks={oldBooks} />

      {selected.length > 2 && (
        <section className="bg-bg-base">
          <div className="px-4 sm:px-6 lg:px-8 pt-24 text-center">
            <FadeIn><h2 className="font-statement text-[clamp(2.8rem,8vw,7rem)]">The <span className="font-serif normal-case font-light text-[0.45em] align-middle mx-1">endless</span> shelf</h2></FadeIn>
            <p className="text-text-muted mt-3">Keep scrolling. It keeps dealing books.</p>
          </div>
          {desktop
            ? <Stage books={selected} title="Most read" total={stageTotal} onSurprise={surprise} onNearEnd={loadMore} />
            : <div className="pt-10"><StageMobile books={selected} title="Most read" onNearEnd={loadMore} /></div>}
        </section>
      )}

      <Journey bg={walls[1] || []} />
      <Authors authors={authors} />
      {currentUser && <ReadingNow items={reading} recs={recs} />}
      <Culture strip={walls[2] || []} trending={trending} />
      <QuizTeaser books={walls[0] || []} />
      <Journal reviews={journal} lists={lists} />
    </div>
  );
};

export default HomePage;
