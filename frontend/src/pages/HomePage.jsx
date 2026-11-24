import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, Compass, Film, Heart, ListOrdered, MessageCircle, Search, Sparkles, Trophy,
} from 'lucide-react';
import BookCard from '../components/BookCard';
import { cn } from '../components/NeoButton';
import { Avatar, CountUp, CoverImage, EASE, timeAgo } from '../components/ui';
import { Book3D, DogEar, PageBall, Paw } from '../components/Dogs';
import { OnlineDot, ShareToFriend } from '../components/social';
import { openPalette } from '../components/shell';
import { useAuth } from '../contexts/AuthContext';
import {
  browseBooks, getBookOfTheDay, getCatalogueStats, getFeaturedAuthors, getGoal, getPersonalizedRecommendations,
  getReadingNow, setGoal,
} from '../services/api';

export const bookPath = (b) => `/book/${encodeURIComponent(b.title)}`;
const pad = (n) => String(n).padStart(2, '0');

/** Red pill, the one button style the site uses. */
export const Pill = ({ to, onClick, children, tone = 'red', className, ...props }) => {
  const cls = cn(
    'group inline-flex items-center gap-2 h-12 px-7 rounded-full whitespace-nowrap font-display text-[22px] leading-none transition-[transform,background-color,color] duration-500 hover:-rotate-3 hover:scale-[1.04]',
    tone === 'red' && 'bg-red text-[#FBFBF4] hover:bg-red-deep',
    tone === 'cream' && 'bg-[#FBFBF4] text-red',
    tone === 'steel' && 'bg-steel text-[#FBFBF4]',
    tone === 'line' && 'border-[1.5px] border-red text-red hover:bg-red hover:text-[#FBFBF4]',
    className,
  );
  const inner = <>{children}<ArrowRight className="w-4 h-4 transition-transform duration-500 group-hover:translate-x-1" /></>;
  return to ? <Link to={to} className={cls} {...props}>{inner}</Link> : <button onClick={onClick} className={cls} {...props}>{inner}</button>;
};

/** Words that rise from behind a mask when scrolled into view. */
// The mask is observed (not the hidden text inside it, which never intersects).
export const Rise = ({ children, className, delay = 0 }) => (
  <motion.span className={cn('block overflow-hidden pt-[0.05em]', className)} initial="hide" whileInView="show" viewport={{ once: true, margin: '0px 0px -8% 0px' }}>
    <motion.span className="block" variants={{ hide: { y: '105%' }, show: { y: 0 } }} transition={{ duration: 1, ease: EASE, delay }}>
      {children}
    </motion.span>
  </motion.span>
);

// =====================================================================
// 1. HERO: two halves of a sentence and a dog-eared book between them
// =====================================================================
const Hero = ({ stats }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const dogY = useTransform(scrollYProgress, [0, 1], ['0%', '22%']);
  const dogScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const leftX = useTransform(scrollYProgress, [0, 1], ['0%', '-18%']);
  const rightX = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  return (
    <section ref={ref} className="relative min-h-[100svh] pt-[96px] overflow-hidden flex flex-col">
      <motion.p className="caps text-center text-[13px] sm:text-[15px]" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }}>
        Your trusted social book diary!
      </motion.p>

      <div className="relative flex-1 grid content-start md:content-stretch md:grid-cols-2 gap-y-2 px-4 sm:px-8 mt-6 md:mt-10 pb-[90vw] md:pb-0">
        <motion.h1 style={{ x: leftX }} className="font-display text-[16vw] md:text-[clamp(3.4rem,10.6vw,13rem)] whitespace-nowrap relative z-0">
          <Rise className="w-max">A dog-eared</Rise>
          <Rise className="w-max" delay={0.08}>book is</Rise>
        </motion.h1>
        <motion.div style={{ x: rightX }} className="md:text-right relative z-0">
          <h1 className="font-display text-[16vw] md:text-[clamp(3.4rem,10.6vw,13rem)] whitespace-nowrap">
            <Rise className="w-max md:ml-auto" delay={0.16}>a loved</Rise>
            <Rise className="w-max md:ml-auto" delay={0.24}>book!</Rise>
          </h1>
          <motion.p className="caps max-w-[260px] md:ml-auto mt-4 leading-snug hidden md:block" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
            {stats ? <><CountUp value={stats.books} /> books, <CountUp value={stats.authors} /> authors</> : 'Thousands of books'} and the readers who wear them out.
          </motion.p>
        </motion.div>

        {/* the dog */}
        <motion.div
          style={{ y: dogY, scale: dogScale }}
          className="absolute left-1/2 bottom-0 -translate-x-1/2 w-[min(80vw,600px)] z-10 origin-bottom"
        >
          <motion.div initial={{ y: '60%' }} animate={{ y: '6%' }} transition={{ duration: 1.4, ease: EASE, delay: 0.35 }}>
            <DogEar animal="dog" seed={7} />
          </motion.div>
        </motion.div>

        {/* round shortcuts, bottom left */}
        <div className="absolute left-4 sm:left-8 bottom-10 z-20 hidden sm:flex gap-2.5">
          {[[Compass, '/explore', 'Explore'], [Film, '/flips', 'Flips'], [Search, null, 'Search']].map(([Icon, to, label]) => {
            const cls = 'w-12 h-12 rounded-full border-[1.5px] border-red text-red flex items-center justify-center hover:bg-red hover:text-[#FBFBF4] transition-colors';
            return to
              ? <Link key={label} to={to} aria-label={label} className={cls}><Icon className="w-5 h-5" /></Link>
              : <button key={label} onClick={openPalette} aria-label={label} className={cls}><Icon className="w-5 h-5" /></button>;
          })}
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// 2. ABOUT: a sentence floating in a cloud of page-balls
// =====================================================================
const CLOUD = [
  [-6, 4, 34], [14, -8, 26], [70, -6, 30], [88, 10, 26], [-4, 52, 30], [24, 60, 34], [52, 48, 38], [80, 56, 30], [36, 18, 18], [62, 22, 16],
];

const About = ({ stats }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const drift = useTransform(scrollYProgress, [0, 1], [80, -80]);
  return (
    <section ref={ref} className="relative overflow-hidden bg-[linear-gradient(180deg,var(--color-bg-base)_0%,var(--color-bg-base)_40%,var(--color-pink)_100%)] pt-24 pb-40 min-h-[110vh] flex items-center">
      <div className="absolute inset-0 pointer-events-none">
        {CLOUD.map(([x, y, w], i) => (
          <motion.div key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%`, width: `${w}vw`, y: i % 2 ? drift : 0 }}>
            <motion.div initial={{ scale: 0.4, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE, delay: (i % 5) * 0.08 }}>
              <PageBall seed={i + 3} className="w-full" />
            </motion.div>
          </motion.div>
        ))}
      </div>
      <div className="relative max-w-[1200px] mx-auto px-6 text-center">
        <p className="font-display text-[clamp(1.9rem,3.7vw,3.6rem)] leading-[0.98] md:whitespace-nowrap">
          <Rise>Here at BookLog we think the books</Rise>
          <Rise delay={0.06}>you read are as much a part of you as,</Rise>
          <Rise delay={0.12}>well, you are! So we keep every one:</Rise>
          <Rise delay={0.18}>rated, reviewed, shared with friends.</Rise>
        </p>
        {stats && (
          <div className="mt-14 flex flex-wrap justify-center gap-4">
            {[['Books', stats.books], ['Authors', stats.authors], ['Genres', stats.genres], ['Pages', stats.pages]].map(([k, v], i) => (
              <motion.div key={k} initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ type: 'spring', stiffness: 160, damping: 14, delay: i * 0.1 }}
                className="w-[132px] h-[132px] sm:w-[150px] sm:h-[150px] rounded-full bg-pink flex flex-col items-center justify-center">
                <span className="font-display text-[clamp(1.8rem,3vw,2.6rem)] tabular-nums"><CountUp value={v} format={(n) => (n >= 100000 ? `${Math.round(n / 1000)}K` : n.toLocaleString())} /></span>
                <span className="caps">{k}</span>
              </motion.div>
            ))}
          </div>
        )}
        <div className="mt-10"><Pill to="/explore" tone="line">Open the catalogue</Pill></div>
      </div>
    </section>
  );
};

// =====================================================================
// 3. OUR SHELVES: every feature is a dog in the middle of a big circle
// =====================================================================
const SHELVES = [
  { name: 'Explore', icon: Compass, to: '/explore', text: 'Every book on one shelf. Filter by genre, decade, length and rating.', dog: { animal: 'cat', prop: 'glasses' } },
  { name: 'Flips', icon: Film, to: '/flips', text: 'Flip through books one screen at a time and see what everyone is saying about each one.', dog: { animal: 'fox', prop: 'cap' } },
  { name: 'Lists', icon: ListOrdered, to: '/lists', text: 'Ranked lists made by readers. Make yours, reorder it, collect likes.', dog: { animal: 'bear', prop: 'crown' } },
  { name: 'Quiz', icon: Trophy, to: '/quiz', text: 'Five questions and we know your reader profile, with books to match.', dog: { animal: 'owl' } },
  { name: 'Messages', icon: MessageCircle, to: '/messages', text: 'Talk books with the people you follow. Send a book right in the chat.', dog: { animal: 'rabbit', prop: 'bow' } },
  { name: 'Assistant', icon: Sparkles, to: '/chat', text: 'Ask for a book the way you’d ask a friend. It knows the whole catalogue.', dog: { animal: 'dog', prop: 'beret' } },
];

const Shelves = () => {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const id = setTimeout(() => setI((n) => (n + 1) % SHELVES.length), 5200);
    return () => clearTimeout(id);
  }, [i, paused]);
  const s = SHELVES[i];
  return (
    <section className="relative bg-pink overflow-hidden pt-20 pb-24" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <h2 className="font-display text-center text-[clamp(4.4rem,16vw,15rem)] relative">
        <Rise>Our shelves</Rise>
        <motion.span className="absolute left-[35%] top-[8%] w-[4.5vw] min-w-[30px] aspect-square rounded-full bg-ball border-2 border-ink-line"
          animate={{ y: [0, -40, 0], rotate: [0, 180, 360] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
      </h2>

      <div className="relative mt-6 h-[660px] sm:h-[min(110vw,760px)]">
        {/* concentric circles */}
        {[1, 0.72, 0.46].map((k, n) => (
          <motion.div key={k} className="absolute left-1/2 top-[26%] sm:top-[8%] -translate-x-1/2 rounded-full"
            style={{ width: `min(${k * 130}vw, ${k * 980}px)`, aspectRatio: 1, background: n === 2 ? 'var(--color-blush)' : 'rgba(251,251,244,0.22)' }}
            initial={{ scale: 0.6, opacity: 0 }} whileInView={{ scale: 1, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE, delay: n * 0.12 }} />
        ))}

        {/* the dog for this shelf */}
        <div className="absolute left-1/2 top-[34%] sm:top-[14%] -translate-x-1/2 w-[min(62vw,380px)]">
          <AnimatePresence mode="wait">
            <motion.div key={s.name} initial={{ y: 60, opacity: 0, rotate: -6 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: -40, opacity: 0, rotate: 6 }} transition={{ duration: 0.6, ease: EASE }}>
              <DogEar seed={11 + i * 7} animal={s.dog.animal} prop={s.dog.prop} ribbon={false} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* number + name, left */}
        <div className="absolute left-4 sm:left-10 top-[72px] sm:top-[6%] max-w-[300px]">
          <AnimatePresence mode="wait">
            <motion.div key={s.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.5 }}>
              <p className="font-display text-[clamp(3rem,6vw,5rem)]">{pad(i + 1)}</p>
              <p className="font-display text-[clamp(2.4rem,4.4vw,4rem)] mt-2">{s.name}</p>
              <p className="caps leading-snug mt-3 hidden sm:block">{s.text}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* round picker, right */}
        <div className="absolute inset-x-0 top-0 flex justify-center gap-2 sm:inset-x-auto sm:right-10 sm:top-[4%] sm:flex-col sm:gap-3">
          {SHELVES.map((x, n) => (
            <button key={x.name} onClick={() => setI(n)} aria-label={x.name}
              className={cn('w-11 h-11 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-500', n === i ? 'bg-red text-[#FBFBF4] scale-110' : 'bg-[#FBFBF4] text-red hover:scale-105')}>
              <x.icon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          ))}
        </div>

        {/* open */}
        <motion.div key={`open-${s.name}`} className="absolute left-1/2 bottom-[6%] -translate-x-1/2 flex flex-col items-center gap-3 text-center px-6"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <p className="caps leading-snug max-w-sm sm:hidden">{s.text}</p>
          <Pill to={s.to} className="rotate-[-6deg]">Open {s.name}</Pill>
        </motion.div>
      </div>
    </section>
  );
};

// =====================================================================
// 4. HOW IT WORKS: four cards dealt onto the pink table
// =====================================================================
const STEPS = [
  ['Sign in', 'One tap with Google. You get a username and a friend code.'],
  ['Pick genres', 'Tell us what you like and your home page starts picking for you.'],
  ['Log & rate', 'Every book gets a date, a rating and, if you like, a review.'],
  ['Find readers', 'Follow people with your taste, message them, swap books.'],
];

const HowItWorks = () => (
  <section className="relative bg-pink overflow-hidden pb-28">
    <div className="relative mx-auto max-w-[1100px] aspect-[2/1] max-h-[520px] min-h-[300px]">
      <div className="absolute inset-x-[-10%] top-[10%] aspect-square rounded-full bg-blush" />
      {[[8, 30], [30, 12], [70, 20], [90, 44]].map(([x, y], n) => (
        <motion.span key={n} className="absolute w-9 h-9 rounded-full bg-[#FBFBF4] border border-red/30 caps flex items-center justify-center" style={{ left: `${x}%`, top: `${y}%` }}
          animate={{ y: [0, -12, 0] }} transition={{ duration: 3 + n * 0.5, repeat: Infinity, ease: 'easeInOut' }}>{n + 1}</motion.span>
      ))}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        <h2 className="font-display text-[clamp(3.4rem,8vw,7rem)]"><Rise>How it works?</Rise></h2>
        <p className="caps mt-4 max-w-sm leading-snug">Sign in, and we’ll be happy to look after your books.</p>
      </div>
    </div>
    <div className="relative px-4 sm:px-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1300px] mx-auto">
      {STEPS.map(([t, d], n) => (
        <motion.div key={t}
          initial={{ y: 120, rotate: n % 2 ? 8 : -8, opacity: 0 }}
          whileInView={{ y: 0, rotate: n % 2 ? 2 : -2, opacity: 1 }}
          whileHover={{ rotate: 0, y: -8 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ type: 'spring', stiffness: 90, damping: 14, delay: n * 0.12 }}
          className="relative bg-[#FBFBF4] text-red rounded-[28px] p-6 min-h-[260px] flex flex-col">
          <div className="flex items-start justify-between">
            <span className="caps opacity-70">Step</span>
            <span className="font-display text-[42px] leading-none">{pad(n + 1)}.</span>
          </div>
          <p className="font-display text-[clamp(2.4rem,3.4vw,3.2rem)] mt-6">{t}</p>
          <p className="caps leading-snug mt-auto pt-6">{d}</p>
        </motion.div>
      ))}
    </div>
  </section>
);

// =====================================================================
// 5. YOUR SHELF (signed in): who you follow is reading what, and picks
// =====================================================================
const YourShelf = ({ items, recs }) => (
  <section className="px-4 sm:px-8 py-24 max-w-[1400px] mx-auto">
    <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
      <h2 className="font-display text-[clamp(3.4rem,8vw,7rem)]"><Rise>Your circle</Rise><Rise delay={0.08}>reads now</Rise></h2>
      <p className="caps max-w-xs leading-snug">What the readers you follow have open right now. A green dot means they’re online. Say hi.</p>
    </div>
    {items.length === 0 ? (
      <div className="rounded-[32px] bg-blush p-10 text-center">
        <p className="font-display text-4xl">Nobody you follow is mid-book</p>
        <p className="caps mt-2">Follow a few readers and their reads land here.</p>
        <div className="mt-6"><Pill to="/people">Find readers</Pill></div>
      </div>
    ) : (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.slice(0, 6).map((r) => (
          <div key={`${r.username}-${r.book_id}`} className="group flex gap-4 p-4 rounded-[28px] bg-blush">
            <Link to={bookPath(r)} className="w-20 aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover shrink-0 transition-transform duration-500 group-hover:-rotate-6"><CoverImage book={r} /></Link>
            <div className="min-w-0 flex-1 flex flex-col">
              <Link to={`/u/${r.username}`} className="flex items-center gap-2 caps">
                <span className="relative"><Avatar username={r.username} size="w-7 h-7 text-xs" /><OnlineDot on={r.online} className="w-2.5 h-2.5" /></span>@{r.username}
              </Link>
              <Link to={bookPath(r)} className="font-display text-[1.7rem] leading-[0.95] mt-2 line-clamp-2">{r.title}</Link>
              <p className="caps opacity-70 mt-1">since {timeAgo(r.since)}</p>
              <Link to={`/messages/${r.username}`} className="mt-auto self-start caps inline-flex items-center gap-1.5 pt-3 link-under"><MessageCircle className="w-3.5 h-3.5" /> Ask how it’s going</Link>
            </div>
          </div>
        ))}
      </div>
    )}
    {recs.length > 0 && (
      <>
        <h3 className="font-display text-[clamp(2.4rem,5vw,4rem)] mt-20 mb-8">Picked for you, with reasons</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-12">
          {recs.slice(0, 4).map((b) => <BookCard key={b.book_id} book={b} source={`recommendation:${b.source}`} />)}
        </div>
      </>
    )}
  </section>
);

// =====================================================================
// 6. TODAY'S PICK: a real 3D book you can turn with your cursor
// =====================================================================
const TodaysPick = ({ today }) => {
  const [share, setShare] = useState(false);
  const { currentUser } = useAuth();
  if (!today) return null;
  return (
    <section className="relative overflow-hidden py-28 px-4 sm:px-8">
      {[[4, 10, 18], [80, 4, 14], [88, 64, 20], [-2, 70, 16]].map(([x, y, w], n) => (
        <div key={n} className="absolute pointer-events-none" style={{ left: `${x}%`, top: `${y}%`, width: `${w}vw`, animation: `bob ${6 + n}s ease-in-out infinite` }}><PageBall seed={n + 40} className="w-full" /></div>
      ))}
      <div className="relative max-w-[1200px] mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="caps">Today’s pick · {new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</p>
          <h2 className="font-display text-[clamp(3.4rem,8vw,7.5rem)] mt-3"><Rise>The book</Rise><Rise delay={0.08}>you deserve!</Rise></h2>
          <p className="font-display text-[clamp(1.8rem,3vw,2.6rem)] mt-8 leading-[0.95]">{today.title}</p>
          <p className="caps mt-2">by {today.authors?.join(', ')}{today.pub_year ? ` · ${today.pub_year}` : ''}{today.page_count ? ` · ${today.page_count} pages` : ''}</p>
          {today.description && <p className="text-[15px] leading-[1.6] mt-5 max-w-lg line-clamp-4">{today.description}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <Pill to={bookPath(today)}>Read more</Pill>
            {currentUser && <Pill tone="line" onClick={() => setShare(true)}>Send to a friend</Pill>}
          </div>
        </div>
        <div className="flex justify-center py-6">
          <motion.div initial={{ rotate: -12, y: 80, opacity: 0 }} whileInView={{ rotate: 0, y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, ease: EASE }}>
            <Link to={bookPath(today)} aria-label={today.title}>
              <Book3D book={today} width={260}><CoverImage book={today} eager /></Book3D>
            </Link>
          </motion.div>
        </div>
      </div>
      {currentUser && <ShareToFriend open={share} onClose={() => setShare(false)} book={today} />}
    </section>
  );
};

// =====================================================================
// 7. AUTHORS: the testimonial wall, but for writers
// =====================================================================
const Authors = ({ authors }) => {
  const [i, setI] = useState(0);
  const list = authors.slice(0, 10);
  useEffect(() => {
    if (!list.length) return undefined;
    const id = setTimeout(() => setI((n) => (n + 1) % list.length), 6500);
    return () => clearTimeout(id);
  }, [i, list.length]);
  if (!list.length) return null;
  const a = list[i];
  const first = (a.bio || '').split(/(?<=\.)\s/)[0];
  return (
    <section className="relative bg-blush overflow-hidden py-24">
      <div className="px-4 sm:px-8">
        <p className="caps">Authors</p>
        <div className="relative mt-5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-lenis-prevent>
          <div className="relative flex min-w-max">
            <span className="absolute left-0 right-0 top-[9px] h-px bg-red/40" />
            {list.map((x, n) => (
              <button key={x.name} onClick={() => setI(n)} className="relative w-[150px] sm:w-[170px] text-center pt-0">
                <span className={cn('mx-auto block rounded-full bg-red transition-all duration-500', n === i ? 'w-[19px] h-[19px] ring-4 ring-red/20' : 'w-2 h-2 mt-[6px] mb-[5px]')} />
                <span className="block caps mt-2 opacity-70">{pad(n + 1)}</span>
                <span className={cn('block caps mt-0.5 truncate px-2', n === i ? 'opacity-100' : 'opacity-60')}>{x.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative max-w-[1200px] mx-auto px-4 sm:px-8 mt-14 grid md:grid-cols-[auto_1fr] gap-10 items-center">
        <div className="relative w-[240px] sm:w-[300px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={a.name} initial={{ scale: 0.7, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ scale: 0.8, opacity: 0, rotate: 8 }} transition={{ duration: 0.6, ease: EASE }}
              className="w-full aspect-square rounded-full overflow-hidden border-[3px] border-red bg-pink">
              <img src={a.photo_url} alt={a.name} className="w-full h-full object-cover" />
            </motion.div>
          </AnimatePresence>
          <div className="absolute -right-10 -bottom-6 w-[46%]"><DogEar animal="fox" prop="quill" seed={51} body={false} ribbon={false} /></div>
          <span className="absolute -left-4 top-6 font-display text-[18px] bg-red text-[#FBFBF4] rounded-full px-4 py-1.5 -rotate-12">{a.books} books</span>
        </div>
        <div className="relative">
          <span className="hidden lg:flex absolute -left-14 top-0 flex-col items-center caps leading-[1.05] opacity-70">{'READ A BIO'.split('').map((c, n) => <span key={n}>{c === ' ' ? ' ' : c}</span>)}</span>
          <AnimatePresence mode="wait">
            <motion.div key={a.name} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.6, ease: EASE }}>
              <p className="font-display text-[clamp(2.6rem,5vw,4.6rem)]">{a.name}</p>
              <p className="font-display text-[clamp(1.4rem,2.2vw,2rem)] leading-[1.05] mt-4 line-clamp-4">{first}</p>
              <p className="caps mt-5">★ {Number(a.avg_rating).toFixed(1)} average · {Number(a.ratings).toLocaleString()} ratings</p>
              <div className="mt-6"><Pill to={`/author/${encodeURIComponent(a.name)}`} tone="line">Read the full story</Pill></div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// 8. PICK YOUR PACE: the price cards, as reading goals
// =====================================================================
const PACES = [
  ['A book a month', 12, 'Slow and steady, a chapter a night'],
  ['Twice a month', 24, 'Breaks down to one every fortnight'],
  ['One a week', 52, 'For the reader who never leaves home without one', true],
];

const Pace = () => {
  const { currentUser, me, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const year = new Date().getFullYear();
  const [goal, setGoalState] = useState(null);
  const [saving, setSaving] = useState(null);
  useEffect(() => {
    if (!currentUser) { setGoalState(null); return; }
    getGoal(year).then(setGoalState).catch(() => {});
  }, [currentUser, year]);
  const choose = async (n) => {
    if (!currentUser) { loginWithGoogle(); return; }
    setSaving(n);
    try { setGoalState(await setGoal(year, n)); } finally { setSaving(null); }
  };
  return (
    <section className="relative bg-sky text-steel overflow-hidden pt-24 pb-[min(40vw,340px)]">
      <h2 className="font-display text-center text-[clamp(3.4rem,9vw,8rem)]"><Rise>Pick your pace</Rise></h2>
      <p className="caps text-center mt-3">Your {year} reading goal{goal?.target_books ? `: ${goal.books_finished} of ${goal.target_books} read` : ''}</p>
      <div className="mt-12 px-4 sm:px-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1300px] mx-auto">
        {PACES.map(([t, n, d, popular], k) => {
          const active = goal?.target_books === n;
          return (
            <motion.div key={t} initial={{ y: 60, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: k * 0.1 }} className="flex flex-col gap-2">
              <div className="relative flex-1 bg-[#FBFBF4] rounded-[22px] p-6 text-center flex flex-col items-center">
                {popular && <span className="absolute left-1/2 -translate-x-1/2 -top-3 caps text-[10px] bg-steel text-[#FBFBF4] rounded-full px-3 py-1 whitespace-nowrap">Most popular</span>}
                <p className="font-display text-[26px]">{t}</p>
                <p className="caps mt-6 opacity-70">Goal</p>
                <p className="font-display text-[clamp(3.6rem,5vw,4.8rem)] leading-none">{n}<span className="text-[0.45em]">\yr.</span></p>
                <p className="caps mt-auto pt-6 leading-snug opacity-80">{d}</p>
              </div>
              <button onClick={() => choose(n)} className={cn('h-12 rounded-full font-display text-[22px] transition-colors', active ? 'bg-red text-[#FBFBF4]' : 'bg-steel text-[#FBFBF4] hover:bg-red')}>
                {saving === n ? 'Saving…' : active ? 'Your goal ✓' : currentUser ? 'Set it' : 'Sign in to set'}
              </button>
            </motion.div>
          );
        })}
        <motion.button
          onClick={() => (me ? navigate(`/u/${me.username}/stats`) : loginWithGoogle())}
          initial={{ y: 60, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: 0.3 }}
          className="group rounded-[22px] bg-steel text-[#FBFBF4] p-6 flex flex-col items-center justify-between min-h-[300px]">
          <p className="font-display text-[26px]">Year in books</p>
          <span className="w-20 h-20 rounded-full bg-[#FBFBF4]/20 flex items-center justify-center transition-transform duration-500 group-hover:rotate-90 group-hover:scale-110"><ArrowUpRight className="w-7 h-7" /></span>
          <p className="caps opacity-80">Your reading, counted and charted</p>
        </motion.button>
      </div>
      {/* a giant dog rising out of the bottom edge */}
      <motion.div className="absolute left-1/2 -translate-x-1/2 bottom-[-12%] w-[min(70vw,560px)]" initial={{ y: '40%' }} whileInView={{ y: '0%' }} viewport={{ once: true }} transition={{ duration: 1.4, ease: EASE }}>
        <DogEar animal="bear" seed={61} prop="glasses" ribbon={false} />
      </motion.div>
    </section>
  );
};

// =====================================================================
// 9. QUESTIONS? ask the assistant
// =====================================================================
const Questions = () => (
  <section className="relative bg-bg-base py-24 px-4 overflow-hidden">
    <div className="relative mx-auto w-[min(92vw,620px)] aspect-square rounded-full bg-pink flex flex-col items-center justify-center text-center px-10">
      <motion.div className="absolute -top-6 right-[8%] w-24" animate={{ rotate: [0, 14, 0] }} transition={{ duration: 3, repeat: Infinity }}><Paw className="w-full text-red/20" /></motion.div>
      <h2 className="font-display text-[clamp(3rem,8vw,6rem)]"><Rise>Have</Rise><Rise delay={0.06}>questions?</Rise></h2>
      <p className="caps mt-4 max-w-xs leading-snug">Ask the assistant for a book the way you’d ask a friend. It answers from the catalogue.</p>
      <div className="mt-6"><Pill to="/chat" className="rotate-[-4deg]">Ask the assistant</Pill></div>
    </div>
  </section>
);

// =====================================================================
// 10. SHARE THE LOVE: covers scattered around a long red ribbon
// =====================================================================
const SPOTS = [
  [2, 8, 13, -6, 0.6], [17, 22, 10, 5, 1.2], [6, 52, 11, 4, 0.9], [20, 70, 13, -4, 1.4], [70, 6, 12, 6, 1.1],
  [86, 24, 11, -5, 0.7], [76, 56, 14, 3, 1.3], [90, 74, 10, -3, 0.8], [34, 84, 9, 6, 1.6], [58, 86, 10, -6, 1],
];

const Floating = ({ book, x, y, w, rot, speed, progress }) => {
  const ty = useTransform(progress, [0, 1], [speed * 120, -speed * 120]);
  return (
    <motion.div className="absolute" style={{ left: `${x}%`, top: `${y}%`, width: `${w}vw`, minWidth: 64, y: ty, rotate: rot }}>
      <Link to={bookPath(book)} className="block aspect-[2/3] rounded-[6px] overflow-hidden shadow-cover transition-transform duration-500 hover:scale-110 hover:rotate-0">
        <CoverImage book={book} />
      </Link>
    </motion.div>
  );
};

const ShareTheLove = ({ books }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const draw = useTransform(scrollYProgress, [0.1, 0.6], [0, 1]);
  return (
    <section ref={ref} className="relative overflow-hidden bg-bg-base min-h-[120vh] flex items-center justify-center">
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        <motion.path d="M500 -20 C 380 160, 640 260, 500 420 S 340 700, 520 820 S 600 980, 480 1040" fill="none" stroke="var(--color-red)" strokeWidth="16" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength: draw }} />
      </svg>
      <div className="absolute inset-0">
        {books.slice(0, SPOTS.length).map((b, n) => {
          const [x, y, w, rot, speed] = SPOTS[n];
          return <Floating key={b.book_id} book={b} x={x} y={y} w={w} rot={rot} speed={speed} progress={scrollYProgress} />;
        })}
      </div>
      <div className="relative text-center px-6">
        <p className="caps flex items-center justify-center gap-2"><Heart className="w-4 h-4" /> Share the love</p>
        <h2 className="font-display text-[clamp(3.4rem,10vw,9rem)] mt-3"><Rise>Of your books</Rise></h2>
        <p className="caps mt-4 max-w-sm mx-auto leading-snug">Follow readers, see your taste match, and send the one they have to read next.</p>
        <div className="mt-8"><Pill to="/people">Find your readers</Pill></div>
      </div>
    </section>
  );
};

// =====================================================================
// PAGE
// =====================================================================
const HomePage = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const [stats, setStats] = useState(null);
  const [today, setToday] = useState(null);
  const [authors, setAuthors] = useState([]);
  const [popular, setPopular] = useState([]);
  const [reading, setReading] = useState([]);
  const [recs, setRecs] = useState([]);

  useEffect(() => {
    getCatalogueStats().then(setStats).catch(() => {});
    getBookOfTheDay().then(setToday).catch(() => {});
    getFeaturedAuthors(10).then(setAuthors).catch(() => {});
    browseBooks({ sort: 'popular', limit: 60 })
      .then((r) => {
        const real = r.books.filter((b) => b.thumbnail?.includes('/b/id/'));
        setPopular(real.length >= 10 ? real : r.books.filter((b) => b.thumbnail));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (authLoading || !currentUser) { setReading([]); setRecs([]); return; }
    getReadingNow().then(setReading).catch(() => {});
    getPersonalizedRecommendations().then(setRecs).catch(() => {});
  }, [currentUser, authLoading]);

  return (
    <div className="overflow-x-clip">
      <Hero stats={stats} />
      <About stats={stats} />
      <Shelves />
      <HowItWorks />
      {currentUser && <YourShelf items={reading} recs={recs} />}
      <TodaysPick today={today} />
      <Authors authors={authors} />
      <Pace />
      <Questions />
      <ShareTheLove books={popular} />
    </div>
  );
};

export default HomePage;
