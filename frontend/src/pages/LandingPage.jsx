import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { DogEar, PageBall, Runner } from '../components/Dogs';
import { CountUp, EASE } from '../components/ui';
import { getCatalogueStats } from '../services/api';

const BALLS = [
  [6, 18, 90, 0], [86, 14, 70, 1.2], [14, 70, 120, 0.6], [80, 66, 140, 2], [44, 8, 56, 1.6], [62, 84, 80, 0.3],
];

/** Round button with text running around its edge. */
const EnterButton = ({ onClick }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ scale: 1.08 }}
    whileTap={{ scale: 0.94 }}
    className="group relative w-[150px] h-[150px] sm:w-[176px] sm:h-[176px] rounded-full bg-red text-[#FBFBF4] flex items-center justify-center"
    aria-label="Enter the project"
  >
    <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full" style={{ animation: 'spin-slow 14s linear infinite' }} aria-hidden="true">
      <defs><path id="ring" d="M100 100 m-74 0 a74 74 0 1 1 148 0 a74 74 0 1 1 -148 0" /></defs>
      <text className="caps" style={{ fontSize: 14, letterSpacing: '0.2em' }} fill="#FBFBF4">
        <textPath href="#ring">Enter the project · Enter the project · </textPath>
      </text>
    </svg>
    <span className="font-display text-[34px] sm:text-[40px] transition-transform duration-500 group-hover:scale-110">Enter</span>
  </motion.button>
);

const LandingPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => { getCatalogueStats().then(setStats).catch(() => {}); }, []);
  const enter = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(() => navigate('/home'), 1100);
  };
  useEffect(() => {
    const onKey = (e) => e.key === 'Enter' && enter();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="relative h-[100svh] min-h-[640px] overflow-hidden bg-bg-base text-red flex flex-col">
      {/* floating page-balls */}
      {BALLS.map(([x, y, s, d], i) => (
        <motion.div key={i} className="absolute pointer-events-none" style={{ left: `${x}%`, top: `${y}%`, width: s }}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 + i * 0.08, type: 'spring', stiffness: 120, damping: 12 }}>
          <div style={{ animation: `bob ${5 + d}s ${d}s ease-in-out infinite` }}><PageBall seed={i + 1} className="w-full drop-shadow-[0_10px_20px_rgba(196,43,32,0.12)]" /></div>
        </motion.div>
      ))}

      {/* top row */}
      <header className="relative z-10 grid grid-cols-3 items-start px-5 sm:px-8 pt-6 caps">
        <span className="leading-snug">RV College of Engineering<br /><span className="opacity-60">Department of ISE</span></span>
        <span className="justify-self-center"><Runner className="w-[72px]" /></span>
        <span className="justify-self-end text-right leading-snug">DBMS · CD252IA<br /><span className="opacity-60">Archit Patil &amp; Bhavya Chawat</span></span>
      </header>

      {/* title + dog */}
      <main className="relative flex-1 flex items-center justify-center">
        <h1 className="relative font-display text-[clamp(5.5rem,23vw,24rem)] leading-[0.8] flex items-end gap-[20vw] sm:gap-[17vw]">
          {['Book', 'Log'].map((w, i) => (
            <span key={w} className="block overflow-hidden pt-[0.06em]">
              <motion.span className="block" initial={{ y: '100%' }} animate={{ y: 0 }} transition={{ duration: 1.1, ease: EASE, delay: 0.15 + i * 0.1 }}>{w}</motion.span>
            </span>
          ))}
        </h1>
        <motion.div
          className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[min(46vw,440px)]"
          initial={{ y: '70%' }}
          animate={{ y: '8%' }}
          transition={{ duration: 1.3, ease: EASE, delay: 0.5 }}
        >
          <DogEar animal="dog" seed={7} />
        </motion.div>
      </main>

      {/* bottom row */}
      <footer className="relative z-10 flex flex-wrap items-end justify-between gap-6 px-5 sm:px-8 pb-6">
        <div className="caps leading-snug max-w-[280px]">
          A social book diary on PostgreSQL, Neo4j &amp; MongoDB.
          {stats && <span className="block mt-2 opacity-70"><CountUp value={stats.books} /> books · <CountUp value={stats.authors} /> authors · {stats.genres} genres</span>}
        </div>
        <EnterButton onClick={enter} />
      </footer>

      {/* exit: the red floods up from the button */}
      <AnimatePresence>
        {leaving && (
          <motion.div
            className="fixed inset-0 z-50 bg-red flex items-center justify-center"
            initial={{ clipPath: 'circle(0% at calc(100% - 110px) calc(100% - 110px))' }}
            animate={{ clipPath: 'circle(160% at calc(100% - 110px) calc(100% - 110px))' }}
            transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
          >
            <motion.div initial={{ x: '-60vw' }} animate={{ x: '60vw' }} transition={{ duration: 1.1, ease: 'easeIn', delay: 0.15 }}>
              <Runner className="w-40" color="#FBFBF4" detail="var(--color-red)" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LandingPage;
