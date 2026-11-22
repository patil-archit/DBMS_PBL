import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AnimatePresence, motion, useAnimationFrame, useMotionValue, useMotionValueEvent, useScroll, useSpring, useTransform, useVelocity,
} from 'framer-motion';
import { ArrowDown, Play } from 'lucide-react';
import BookCard from './BookCard';
import { cn } from './NeoButton';
import { CoverImage, EASE } from './ui';
import { scrollToY } from './shell';
import { coverPalette } from '../utils/colors';

export const pad = (n) => String(n).padStart(2, '0');
export const bookPath = (b) => `/book/${encodeURIComponent(b.title)}`;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const blurb = (b) => b.reason || (b.description ? `${b.description.split(/(?<=\.)\s/)[0].slice(0, 150)}` : `${(b.categories || [])[0] || 'A book'} by ${b.authors?.[0] || 'unknown'}.`);

export const useIsDesktop = () => {
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px)');
    const on = () => setD(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return d;
};

// =====================================================================
// STAGE: scroll-driven showcase (desktop)
// =====================================================================

/** A cover flying through 3D space: upcoming books stack above, past books fall into the counter. */
const FlyingCover = ({ book, i, f }) => {
  const transform = useTransform(f, (v) => {
    const d = i - v;
    if (d >= 0) {
      const x = 6 + d * 6.5;
      const y = -30 - d * 9;
      return `translate3d(calc(-50% + ${x}vw), calc(-50% + ${y}vh), ${-d * 90}px) rotateX(${38 + d * 3}deg) rotateY(${-14}deg) rotateZ(${-10 + d * 2.5}deg) scale(${0.62 - d * 0.04})`;
    }
    const a = -d;
    const x = -24 - a * 3.5;
    const y = 30 + a * 4;
    return `translate3d(calc(-50% + ${x}vw), calc(-50% + ${y}vh), ${-a * 80}px) rotateX(${55 + a * 2}deg) rotateY(8deg) rotateZ(${-16 + a * 3}deg) scale(${0.55 - a * 0.03})`;
  });
  const opacity = useTransform(f, (v) => {
    const d = i - v;
    return d >= 0 ? clamp01((d - 0.25) / 0.6) * clamp01(4.2 - d) : clamp01((-d - 0.25) / 0.6) * clamp01(5 + d);
  });
  return (
    <motion.div
      className="absolute left-1/2 top-1/2 w-[13vw] aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover will-change-transform pointer-events-none"
      style={{ transform, opacity }}
    >
      <CoverImage book={book} eager={i < 4} />
    </motion.div>
  );
};

/** A row in the right-hand list: sharp when focused, blurred and faded further away. */
const ListRow = ({ book, i, f, onClick }) => {
  const opacity = useTransform(f, (v) => 1 - Math.min(1, Math.abs(i - v)) * 0.78);
  const filter = useTransform(f, (v) => `blur(${Math.min(1.4, Math.abs(i - v)) * 2.2}px)`);
  return (
    <motion.button
      onClick={onClick}
      style={{ opacity, filter }}
      className="h-[150px] w-full flex flex-col items-center justify-center text-center px-6"
      data-cursor="Open"
    >
      <span className="label">{(book.categories || [])[0] || 'Book'}</span>
      <span className="font-wide font-medium text-[16px] leading-tight mt-1.5 line-clamp-2">{book.title}</span>
      <span className="w-3 h-px bg-text-main my-2.5" />
      <span className="text-[11px] leading-[1.4] max-w-[17rem] line-clamp-3">{blurb(book)}</span>
    </motion.button>
  );
};

const RollingNumber = ({ value, className }) => (
  <span className={cn('relative inline-flex overflow-hidden', className)}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ y: '100%' }}
        animate={{ y: '0%' }}
        exit={{ y: '-100%' }}
        transition={{ duration: 0.8, ease: EASE }}
        className="block"
      >
        {value}
      </motion.span>
    </AnimatePresence>
  </span>
);

const Swap = ({ k, children, className }) => (
  <AnimatePresence mode="wait" initial={false}>
    <motion.span
      key={k}
      initial={{ opacity: 0, filter: 'blur(6px)', y: 6 }}
      animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
      exit={{ opacity: 0, filter: 'blur(6px)', y: -6 }}
      transition={{ duration: 0.45, ease: EASE }}
      className={cn('block', className)}
    >
      {children}
    </motion.span>
  </AnimatePresence>
);

const STEP_VH = 42;

export const Stage = ({ books, title, total, onSurprise, onNearEnd }) => {
  const ref = useRef(null);
  const navigate = useNavigate();
  const n = books.length;
  const nRef = useRef(n);
  nRef.current = n;
  const top = useRef(0);
  const { scrollY } = useScroll();
  useEffect(() => {
    const measure = () => { if (ref.current) top.current = ref.current.getBoundingClientRect().top + window.scrollY; };
    measure();
    const id = setTimeout(measure, 600);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(id); window.removeEventListener('resize', measure); };
  }, []);
  // Position in the stack comes from absolute scroll, so adding books never makes it jump
  const raw = useTransform(scrollY, (y) => Math.max(0, Math.min(nRef.current - 1, (y - top.current) / (window.innerHeight * STEP_VH / 100))));
  const f = useSpring(raw, { stiffness: 90, damping: 22, mass: 0.6 });
  const [active, setActive] = useState(0);
  const [palette, setPalette] = useState([]);
  useMotionValueEvent(f, 'change', (v) => {
    const a = Math.max(0, Math.min(n - 1, Math.round(v)));
    if (a !== active) setActive(a);
    if (a >= n - 6) onNearEnd?.();
  });
  const listY = useTransform(f, (v) => -v * 150);
  const book = books[active];

  useEffect(() => {
    let live = true;
    coverPalette(book?.thumbnail).then((p) => live && setPalette(p));
    return () => { live = false; };
  }, [book?.thumbnail]);

  const meta = [
    ['Author', book.authors?.slice(0, 2).join(', ') || '—'],
    ['Published', book.pub_year || '—'],
    ['Length', book.page_count ? `${book.page_count} pages` : '—'],
    ['Rating', book.average_rating ? `${Number(book.average_rating).toFixed(2)} / 5` : '—'],
    ['Genres', (book.categories || []).slice(0, 3).join(', ') || '—'],
  ];

  return (
    <section ref={ref} style={{ height: `${(n - 1) * STEP_VH + 100}vh` }} className="relative">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* 3D flight */}
        <div className="absolute inset-0 [perspective:1400px] [transform-style:preserve-3d]">
          {books.map((b, i) => (Math.abs(i - active) <= 7 ? <FlyingCover key={b.book_id} book={b} i={i} f={f} /> : null))}
        </div>

        {/* Featured cover, wiped in from below */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[18vw] max-w-[300px] aspect-[2/3]">
          <AnimatePresence initial={false}>
            <motion.button
              key={book.book_id}
              onClick={() => navigate(bookPath(book))}
              data-cursor="Open"
              className="absolute inset-0 rounded-[3px] overflow-hidden shadow-cover"
              initial={{ clipPath: 'inset(100% 0 0 0)' }}
              animate={{ clipPath: 'inset(0% 0 0 0)' }}
              exit={{ opacity: 0, transition: { delay: 0.7, duration: 0.01 } }}
              transition={{ duration: 0.9, ease: EASE }}
            >
              <motion.span className="block w-full h-full" initial={{ scale: 1.25 }} animate={{ scale: 1 }} transition={{ duration: 1.3, ease: EASE }}>
                <CoverImage book={book} eager />
              </motion.span>
            </motion.button>
          </AnimatePresence>
        </div>

        {/* Left: details of the focused book */}
        <div className="absolute left-[38px] top-[40%] w-[30vw] grid grid-cols-[90px_1fr] gap-x-6 gap-y-5">
          {meta.map(([k, v]) => (
            <React.Fragment key={k}>
              <span className="label">{k}</span>
              <Swap k={`${active}-${k}`} className="value max-w-[14rem]">{v}</Swap>
            </React.Fragment>
          ))}
        </div>

        {/* Bottom-left: counter */}
        <div className="absolute left-[calc(38px+90px+24px)] bottom-[4vh] flex items-start gap-3">
          <span className="label mt-1">{title}</span>
        </div>
        <div className="absolute left-[24vw] bottom-0 translate-y-[18%] flex items-start text-text-main">
          <RollingNumber value={pad(active + 1)} className="display-num text-[clamp(7rem,14vw,13rem)]" />
          <span className="text-[12px] mt-[1.2vw] ml-2 tabular-nums">/{total ? total.toLocaleString() : pad(n)}</span>
        </div>

        {/* Right: focus list */}
        <div className="absolute right-[6vw] top-0 bottom-0 w-[24vw] min-w-[280px] overflow-hidden [mask-image:linear-gradient(transparent,black_25%,black_75%,transparent)]">
          <motion.div className="absolute left-0 right-0 top-[calc(50%-75px)]" style={{ y: listY }}>
            {books.map((b, i) => (Math.abs(i - active) <= 6
              ? <ListRow key={b.book_id} book={b} i={i} f={f} onClick={() => navigate(bookPath(b))} />
              : <div key={b.book_id} className="h-[150px]" />))}
          </motion.div>
        </div>

        {/* Right edge: colours pulled from the cover */}
        <div className="absolute right-[38px] top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
          {palette.map((c, i) => (
            <motion.span
              key={`${active}-${i}`}
              className="w-3 h-3 block"
              style={{ background: c }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
              title={c}
            />
          ))}
        </div>

        {/* Bottom-right: skip + surprise */}
        <button
          onClick={() => ref.current && scrollToY(ref.current.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 2)}
          className="absolute right-[38px] bottom-[calc(4vh+28px)] flex items-center gap-2 value !text-[12px] group"
        >
          <span className="link-under">Skip the shelf</span>
          <ArrowDown className="w-3 h-3 transition-transform duration-500 group-hover:translate-y-1" />
        </button>
        <button onClick={onSurprise} className="absolute right-[38px] bottom-[4vh] flex items-center gap-2 value !text-[12px] group">
          <span className="link-under">Surprise me</span>
          <Play className="w-3 h-3 fill-current transition-transform duration-500 group-hover:translate-x-1" />
        </button>
      </div>
    </section>
  );
};

/** Mobile version of the showcase: a swipeable strip. */
export const StageMobile = ({ books, title, onNearEnd }) => (
  <section className="px-5 sm:px-8 pb-16">
    <div className="flex items-baseline justify-between border-t border-border pt-3 mb-6">
      <span className="label">{title}</span>
      <span className="label">/{pad(books.length)}</span>
    </div>
    <div
      className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-px-5 sm:scroll-px-8 -mx-5 px-5 sm:-mx-8 sm:px-8 pb-4"
      data-lenis-prevent
      onScroll={(e) => { const el = e.currentTarget; if (el.scrollLeft + el.clientWidth > el.scrollWidth - 600) onNearEnd?.(); }}
    >
      {books.map((b, i) => (
        <div key={b.book_id} className="snap-start shrink-0 w-[58vw] sm:w-[34vw]">
          <BookCard book={b} index={i} source="home" />
        </div>
      ))}
    </div>
  </section>
);

/** A row that drifts on its own and speeds up (or reverses) with the scroll. */
export const VelocityRow = ({ books, base = -2.5 }) => {
  const x = useMotionValue(0);
  const width = useRef(1);
  const track = useRef(null);
  const { scrollY } = useScroll();
  const vel = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const dir = useRef(1);
  useEffect(() => {
    const m = () => { if (track.current) width.current = track.current.scrollWidth / 2; };
    m();
    const id = setTimeout(m, 1200);
    window.addEventListener('resize', m);
    return () => { clearTimeout(id); window.removeEventListener('resize', m); };
  }, [books.length]);
  useAnimationFrame((_, delta) => {
    const v = vel.get();
    if (v < -1) dir.current = -1; else if (v > 1) dir.current = 1;
    let move = dir.current * base * (delta / 1000) * 20;
    move += dir.current * move * Math.min(6, Math.abs(v) / 300);
    let next = x.get() + move;
    const w = width.current;
    if (next <= -w) next += w;
    if (next > 0) next -= w;
    x.set(next);
  });
  const row = [...books, ...books];
  return (
    <motion.div ref={track} className="flex gap-6 w-max" style={{ x }}>
      {row.map((b, i) => (
        <Link key={`${b.book_id}-${i}`} to={bookPath(b)} data-cursor="Open" className="group w-[150px] md:w-[180px] shrink-0">
          <div className="aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-3 group-hover:rotate-[-2deg]">
            <CoverImage book={b} />
          </div>
          <p className="text-[12px] mt-3 line-clamp-1">{b.title}</p>
          <p className="label line-clamp-1">{b.authors?.[0]}</p>
        </Link>
      ))}
    </motion.div>
  );
};

