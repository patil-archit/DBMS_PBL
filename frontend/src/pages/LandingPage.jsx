import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { ArrowRight, CornerDownLeft } from 'lucide-react';
import { LogoMark } from '../components/Logo';
import { CountUp, CoverImage, EASE } from '../components/ui';
import { LiveClock } from '../components/shell';
import { browseBooks, getCatalogueStats } from '../services/api';

const DBS = [
  ['01', 'PostgreSQL', 'Catalogue, diary, lists. Triggers, full-text + trigram search, row-level security, materialized views.'],
  ['02', 'Neo4j', 'The social graph: follows, taste match, friends-of-friends and shortest paths between readers.'],
  ['03', 'MongoDB', 'Activity logs, trending books, recommendation cache and the assistant’s chat history.'],
];

/** One column of the cover wall: a list rendered twice that loops forever. */
const Column = ({ books, duration, reverse }) => (
  <div className="relative overflow-hidden h-full">
    <div
      className="flex flex-col gap-4 will-change-transform"
      style={{ animation: `wall ${duration}s linear infinite${reverse ? ' reverse' : ''}` }}
    >
      {[...books, ...books].map((b, i) => (
        <div key={`${b.book_id}-${i}`} className="aspect-[2/3] rounded-[4px] overflow-hidden shrink-0 shadow-cover">
          <CoverImage book={b} eager={i < 6} />
        </div>
      ))}
    </div>
  </div>
);

/** A button that leans toward the pointer. */
const Magnetic = ({ children, strength = 0.35 }) => {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 15, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 200, damping: 15, mass: 0.4 });
  return (
    <motion.div
      ref={ref}
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [stats, setStats] = useState(null);
  const [leaving, setLeaving] = useState(null);
  const btn = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const smx = useSpring(mx, { stiffness: 50, damping: 20 });
  const smy = useSpring(my, { stiffness: 50, damping: 20 });
  const wallX = useTransform(smx, (v) => v * -40);
  const wallY = useTransform(smy, (v) => v * -30);
  const glowX = useTransform(smx, (v) => `${50 + v * 30}%`);
  const glowY = useTransform(smy, (v) => `${50 + v * 30}%`);
  const glow = useTransform([glowX, glowY], ([x, y]) => `radial-gradient(600px circle at ${x} ${y}, rgba(216,50,43,0.18), transparent 60%)`);

  useEffect(() => {
    // The landing page is its own intro, so skip the loader on the next page
    try { sessionStorage.setItem('booklog-intro', '1'); } catch { /* ignore */ }
    Promise.all([
      browseBooks({ sort: 'popular', limit: 60 }),
      browseBooks({ sort: 'rating', limit: 60 }),
    ]).then(([a, b]) => {
      const seen = new Set();
      setBooks([...a.books, ...b.books].filter((x) => x.thumbnail && !seen.has(x.book_id) && seen.add(x.book_id)));
    }).catch(() => {});
    getCatalogueStats().then(setStats).catch(() => {});
  }, []);

  const enter = () => {
    if (leaving) return;
    const r = btn.current?.getBoundingClientRect();
    setLeaving(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setTimeout(() => navigate('/home'), 900);
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Enter') enter(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cols = 7;
  const columns = Array.from({ length: cols }, (_, c) => books.filter((_, i) => i % cols === c));

  return (
    <div
      className="fixed inset-0 bg-roast text-latte overflow-hidden select-none"
      onMouseMove={(e) => { mx.set(e.clientX / window.innerWidth - 0.5); my.set(e.clientY / window.innerHeight - 0.5); }}
    >
      {/* Endless tilted wall of covers */}
      <motion.div className="absolute inset-[-25%] [perspective:1600px]" style={{ x: wallX, y: wallY }}>
        <motion.div
          className="absolute inset-0 grid gap-4 [transform:rotateX(28deg)_rotateZ(-14deg)_scale(1.05)]"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          initial={{ opacity: 0, scale: 1.2 }}
          animate={{ opacity: books.length ? 1 : 0, scale: 1 }}
          transition={{ duration: 2.2, ease: EASE }}
        >
          {books.length > 0 && columns.map((col, i) => <Column key={i} books={col} duration={50 + (i % 3) * 14} reverse={i % 2 === 1} />)}
        </motion.div>
      </motion.div>

      {/* Darkening + a spotlight that follows the pointer */}
      <div className="absolute inset-0 bg-roast/75" />
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: glow }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#1A100C_80%)]" />

      {/* Top bar */}
      <motion.div
        className="absolute top-0 inset-x-0 px-5 sm:px-10 pt-6 flex items-start justify-between text-[11px] sm:text-[12px] font-medium"
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 0.8 }}
      >
        <span className="flex items-center gap-3">
          <LogoMark className="w-5 h-6" />
          <span className="leading-tight">RV College of Engineering<br /><span className="opacity-50">Dept. of CSE</span></span>
        </span>
        <span className="hidden md:block text-center leading-tight">DBMS Project · CD252IA<br /><span className="opacity-50">Academic year 2025–26</span></span>
        <span className="text-right leading-tight">Reading globally<br /><span className="opacity-50"><LiveClock /></span></span>
      </motion.div>

      {/* Centre */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: EASE, delay: 0.1 }}>
          <LogoMark animate className="w-12 h-14 sm:w-16 sm:h-[74px] mx-auto" />
        </motion.div>

        <h1 className="mt-6 font-statement text-sand text-[clamp(4.4rem,19vw,18rem)] leading-[0.82] flex">
          {'BOOKLOG'.split('').map((c, i) => (
            <span key={i} className="inline-block overflow-hidden">
              <motion.span
                className="inline-block"
                initial={{ y: '110%', rotate: 8 }}
                animate={{ y: '0%', rotate: 0 }}
                transition={{ duration: 1.2, ease: EASE, delay: 0.35 + i * 0.06 }}
                whileHover={{ y: '-8%', color: '#D8322B', transition: { duration: 0.25 } }}
              >
                {c}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          className="font-serif text-[clamp(1.4rem,2.6vw,2.4rem)] leading-[1.1] mt-4 max-w-5xl"
          initial={{ opacity: 0, y: 20, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.2, ease: EASE, delay: 1 }}
        >
          A social diary for <em className="text-accent-red">every</em> book you’ll ever read,
          <br className="hidden sm:block" /> built on three databases.
        </motion.p>

        <motion.div className="mt-10 flex flex-col items-center gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 1.3 }}>
          <Magnetic>
            <button
              ref={btn}
              onClick={enter}
              data-cursor="Enter"
              className="group relative h-16 sm:h-[72px] pl-8 pr-3 rounded-full bg-cream text-espresso flex items-center gap-6 overflow-hidden font-medium text-[15px] sm:text-[15px] tracking-[0.02em]"
            >
              <span className="absolute inset-0 bg-accent-red translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]" />
              <span className="relative z-10 group-hover:text-white transition-colors duration-300">Enter project</span>
              <span className="relative z-10 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-accent-red text-white flex items-center justify-center overflow-hidden">
                <ArrowRight className="w-5 h-5 transition-transform duration-500 group-hover:translate-x-10" />
                <ArrowRight className="w-5 h-5 absolute -translate-x-10 transition-transform duration-500 group-hover:translate-x-0" />
              </span>
            </button>
          </Magnetic>
          <span className="text-[11px] opacity-50 flex items-center gap-1.5">or press <kbd className="px-1.5 py-0.5 rounded border border-white/25 inline-flex items-center gap-1">Enter <CornerDownLeft className="w-3 h-3" /></kbd></span>
        </motion.div>

        {stats && (
          <motion.div className="mt-10 flex gap-8 sm:gap-14 text-left" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.6 }}>
            {[['Books', stats.books], ['Authors', stats.authors], ['Genres', stats.genres]].map(([k, v]) => (
              <div key={k}>
                <p className="display-num text-[clamp(1.6rem,3vw,2.6rem)] tabular-nums"><CountUp value={v} /></p>
                <p className="text-[11px] opacity-50">{k}</p>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Bottom: the three databases + team */}
      <div className="absolute bottom-0 inset-x-0 px-5 sm:px-10 pb-6 hidden md:grid grid-cols-12 gap-6 items-end">
        {DBS.map(([n, name, desc], i) => (
          <motion.div
            key={name}
            className="col-span-3 group border-t border-white/15 pt-3 hover:border-accent-red transition-colors"
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 1.5 + i * 0.1 }}
          >
            <p className="text-[11px] opacity-50 tabular-nums">{n}</p>
            <p className="font-wide font-semibold uppercase text-[15px] mt-1 group-hover:text-accent-red transition-colors">{name}</p>
            <p className="text-[11px] leading-[1.45] opacity-60 mt-1 max-w-[17rem] max-h-0 group-hover:max-h-24 overflow-hidden transition-[max-height] duration-700">{desc}</p>
          </motion.div>
        ))}
        <motion.div className="col-span-3 text-right text-[11px] leading-tight" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 }}>
          <span className="opacity-50">Built by</span><br />Archit Patil &amp; Bhavya Chawat
        </motion.div>
      </div>

      {/* Exit: a red circle grows from the button, then a black one */}
      <AnimatePresence>
        {leaving && (
          <>
            <motion.div
              className="fixed inset-0 z-[500] bg-accent-red"
              initial={{ clipPath: `circle(0px at ${leaving.x}px ${leaving.y}px)` }}
              animate={{ clipPath: `circle(150vmax at ${leaving.x}px ${leaving.y}px)` }}
              transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
            />
            <motion.div
              className="fixed inset-0 z-[501] bg-espresso flex items-center justify-center"
              initial={{ clipPath: `circle(0px at ${leaving.x}px ${leaving.y}px)` }}
              animate={{ clipPath: `circle(150vmax at ${leaving.x}px ${leaving.y}px)` }}
              transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: 0.15 }}
            >
              <LogoMark className="w-12 h-14 text-latte" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LandingPage;
