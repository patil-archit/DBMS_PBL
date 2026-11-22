import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Bell, ChevronDown, Dices, MessageCircle, Moon, Search, Sun } from 'lucide-react';
import { cn } from './NeoButton';
import { Avatar, CoverImage, EASE } from './ui';
import { LogoMark, Wordmark } from './Logo';
import { LiveClock, openPalette, useTheme } from './shell';
import { CountBadge, NotificationsPanel, usePulse } from './social';
import { useAuth } from '../contexts/AuthContext';
import { getBookOfTheDay, getCatalogueStats, getGenreIndex, getRandomBook } from '../services/api';

export const NAV = [
  { name: 'Home', path: '/home' },
  { name: 'Explore', path: '/explore' },
  { name: 'Reels', path: '/reels' },
  { name: 'Reader quiz', path: '/quiz' },
  { name: 'Search', path: '/search' },
  { name: 'Lists', path: '/lists' },
  { name: 'Messages', path: '/messages', auth: true },
  { name: 'Feed', path: '/feed', auth: true },
  { name: 'People', path: '/people', auth: true },
  { name: 'Assistant', path: '/chat', auth: true },
  { name: 'My Books', path: '/library', auth: true },
];

const useActive = () => {
  const { pathname } = useLocation();
  return (path) => pathname === path || pathname.startsWith(`${path}/`);
};

// ---------------------------------------------------------------------
// Scramble: letters shuffle and settle on hover
// ---------------------------------------------------------------------
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#*/+';
export const Scramble = ({ text, play }) => {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!play) { setOut(text); return undefined; }
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      setOut(text.split('').map((c, i) => (c === ' ' || frame / 2.5 > i ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)])).join(''));
      if (frame >= text.length * 2.5) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, [play, text]);
  return <span>{out}</span>;
};

/** The little squiggle on the round menu button. */
const Squiggle = ({ open }) => (
  <svg viewBox="0 0 28 16" className="w-6 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <motion.path
      d={open ? 'M5 3 L23 13 M5 13 L23 3' : 'M2 9 L7 9 L10 3 L14 13 L18 6 L20 9 L26 9'}
      initial={false}
      animate={{ pathLength: [0, 1] }}
      transition={{ duration: 0.6, ease: EASE }}
    />
  </svg>
);

/** Red bookmark that hangs from the middle of the pill and swings on hover. */
const Badge = () => (
  <Link to="/home" aria-label="BookLog home" className="absolute left-1/2 -translate-x-1/2 -top-[14px] z-10 group">
    <motion.span
      className="block origin-top"
      initial={{ y: -90 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 160, damping: 13, delay: 0.3 }}
      whileHover={{ rotate: [0, -6, 5, -3, 0], transition: { duration: 0.9 } }}
    >
      <svg viewBox="0 0 72 92" className="w-[64px] h-[82px] drop-shadow-[0_12px_18px_rgba(0,0,0,0.35)]">
        <path d="M6 0h60a6 6 0 0 1 6 6v80.5a3 3 0 0 1-4.8 2.4L36 66 4.8 88.9A3 3 0 0 1 0 86.5V6a6 6 0 0 1 6-6z" fill="#D8322B" />
        <path d="M6 0h60a6 6 0 0 1 6 6v6H0V6a6 6 0 0 1 6-6z" fill="#B8241E" />
      </svg>
      <span className="absolute left-1/2 top-[22px] -translate-x-1/2 text-cream">
        <LogoMark className="w-[22px] h-[26px]" ribbon="#2B1B14" />
      </span>
      <span className="absolute left-1/2 top-[52px] -translate-x-1/2 font-wide font-semibold text-[8px] tracking-[0.18em] text-cream">BOOKLOG</span>
    </motion.span>
  </Link>
);

// ---------------------------------------------------------------------
// Mega menu under "Discover"
// ---------------------------------------------------------------------
const MegaMenu = ({ open, onClose }) => {
  const [genres, setGenres] = useState([]);
  const [today, setToday] = useState(null);
  useEffect(() => {
    if (!open || genres.length) return;
    getGenreIndex().then((g) => setGenres(g.slice(0, 12))).catch(() => {});
    getBookOfTheDay().then(setToday).catch(() => {});
  }, [open, genres.length]);
  const links = [
    ['Explore the catalogue', '/explore', 'Every book, filtered your way'],
    ['Book reels', '/reels', 'One book per screen, with takes'],
    ['Reader quiz', '/quiz', 'Find your reader profile'],
    ['Ranked lists', '/lists', 'Made and liked by readers'],
    ['Search', '/search', 'Spelling mistakes allowed'],
  ];
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8, clipPath: 'inset(0 0 100% 0 round 22px)' }}
          animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0 round 22px)' }}
          exit={{ opacity: 0, y: -8, clipPath: 'inset(0 0 100% 0 round 22px)' }}
          transition={{ duration: 0.5, ease: EASE }}
          className="absolute left-0 right-0 top-[calc(100%+10px)] rounded-[22px] bg-espresso/95 backdrop-blur-xl text-latte p-7 grid grid-cols-12 gap-8 shadow-brutal-lg"
          onMouseLeave={onClose}
        >
          <div className="col-span-4">
            <p className="text-[11px] uppercase tracking-[0.12em] opacity-50 mb-3">Discover</p>
            {links.map(([t, href, d], i) => (
              <motion.div key={href} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                <Link to={href} onClick={onClose} className="group flex items-center justify-between py-2.5 border-b border-latte/10">
                  <span>
                    <span className="block font-wide font-semibold text-[22px] leading-none group-hover:text-accent-red transition-colors">{t}</span>
                    <span className="block text-[12px] opacity-50 mt-1">{d}</span>
                  </span>
                  <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500" />
                </Link>
              </motion.div>
            ))}
          </div>
          <div className="col-span-4">
            <p className="text-[11px] uppercase tracking-[0.12em] opacity-50 mb-3">Popular shelves</p>
            <div className="grid grid-cols-2 gap-x-4">
              {genres.map((g) => (
                <Link key={g.name} to={`/explore?genre=${encodeURIComponent(g.name)}`} onClick={onClose} className="py-1.5 text-[14px] flex justify-between hover:text-accent-red transition-colors">
                  <span>{g.name}</span><span className="opacity-40 tabular-nums text-[12px]">{g.book_count}</span>
                </Link>
              ))}
            </div>
          </div>
          {today && (
            <Link to={`/book/${encodeURIComponent(today.title)}`} onClick={onClose} className="col-span-4 group rounded-[16px] bg-latte/[0.06] p-4 flex gap-4 hover:bg-latte/10 transition-colors">
              <div className="w-24 aspect-[2/3] rounded-[3px] overflow-hidden shadow-cover shrink-0 transition-transform duration-700 group-hover:-rotate-3 group-hover:scale-105"><CoverImage book={today} /></div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.12em] opacity-50">Book of the day</p>
                <p className="font-serif text-[1.6rem] leading-[1] mt-2 line-clamp-3">{today.title}</p>
                <p className="text-[12px] opacity-60 mt-2">{today.authors?.[0]}</p>
                <span className="inline-flex items-center gap-1.5 mt-4 text-[12px] font-medium">Read more <ArrowUpRight className="w-3.5 h-3.5" /></span>
              </div>
            </Link>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ---------------------------------------------------------------------
// Account menu
// ---------------------------------------------------------------------
const Account = () => {
  const { currentUser, me, isStaff, loginWithGoogle, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (!currentUser) {
    return (
      <button onClick={loginWithGoogle} className="h-14 px-6 rounded-full bg-latte text-espresso text-[12px] font-semibold uppercase tracking-[0.06em] hover:bg-accent-red hover:text-white transition-colors whitespace-nowrap">
        Sign in
      </button>
    );
  }
  const links = [
    ...(me ? [{ name: 'Profile', path: `/u/${me.username}` }, { name: 'Year in books', path: `/u/${me.username}/stats` }] : []),
    { name: 'My books', path: '/library' },
    { name: 'Messages', path: '/messages' },
    { name: 'Settings', path: '/settings' },
    ...(isStaff ? [{ name: me?.role === 'admin' ? 'Admin' : 'Moderation', path: '/admin' }] : []),
  ];
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" className="w-14 h-14 rounded-full bg-espresso/75 backdrop-blur-xl flex items-center justify-center hover:ring-2 hover:ring-latte/40 transition">
        {currentUser.photoURL ? (
          <img src={currentUser.photoURL} alt="" className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <Avatar username={me?.username || '?'} size="w-10 h-10 text-base" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="absolute right-0 mt-3 w-64 origin-top-right bg-espresso text-latte rounded-[20px] p-2 z-50 shadow-brutal-lg"
          >
            {me && <p className="px-3 pt-2 pb-3 text-[12px] opacity-60">Signed in as <b className="opacity-100 text-latte">@{me.username}</b></p>}
            {links.map((l, i) => (
              <motion.div key={l.name} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}>
                <Link role="menuitem" to={l.path} className="flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[14px] hover:bg-latte/10 transition-colors">
                  {l.name} <ArrowUpRight className="w-3.5 h-3.5 opacity-50" />
                </Link>
              </motion.div>
            ))}
            <button role="menuitem" onClick={logout} className="w-full text-left px-3 py-2.5 mt-1 rounded-[12px] border-t border-latte/10 text-[14px] text-accent-red hover:bg-latte/10">
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Round = ({ children, className, ...props }) => (
  <button className={cn('relative w-14 h-14 rounded-full bg-espresso/75 backdrop-blur-xl text-latte flex items-center justify-center hover:bg-espresso transition-colors', className)} {...props}>
    {children}
  </button>
);

// ---------------------------------------------------------------------
// Full-screen menu
// ---------------------------------------------------------------------
const MenuOverlay = ({ open, onClose, items }) => {
  const isActive = useActive();
  const navigate = useNavigate();
  const { me, currentUser, loginWithGoogle, logout } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const [hover, setHover] = useState(null);
  const random = async () => { onClose(); try { const b = await getRandomBook(); navigate(`/book/${encodeURIComponent(b.title)}`); } catch { /* ignore */ } };
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] bg-espresso text-latte flex flex-col"
          initial={{ clipPath: 'circle(0% at 44px 44px)' }}
          animate={{ clipPath: 'circle(150% at 44px 44px)' }}
          exit={{ clipPath: 'circle(0% at 44px 44px)' }}
          transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          data-lenis-prevent
        >
          <div className="flex items-center justify-between px-5 sm:px-8 pt-5 h-24">
            <button onClick={onClose} className="w-14 h-14 rounded-full bg-latte/10 flex items-center justify-center" aria-label="Close menu"><Squiggle open /></button>
            <span className="flex items-center gap-3"><LogoMark className="w-6 h-7" /><Wordmark className="text-[18px]" /></span>
            <span className="text-[12px] opacity-60 hidden sm:block"><LiveClock /></span>
          </div>
          <div className="flex-1 grid lg:grid-cols-12 gap-8 px-5 sm:px-8 overflow-y-auto">
            <nav className="lg:col-span-8 py-4" onMouseLeave={() => setHover(null)}>
              {items.map((item, i) => (
                <div key={item.path} className="overflow-hidden">
                  <motion.div initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.2 + i * 0.04 }}>
                    <Link
                      to={item.path}
                      onClick={onClose}
                      onMouseEnter={() => setHover(item.path)}
                      className={cn('flex items-baseline gap-4 py-1 font-wide font-semibold uppercase leading-[0.95] text-[clamp(2.4rem,7vw,5.6rem)] transition-[color,opacity] duration-300',
                        isActive(item.path) ? 'text-accent-red' : hover && hover !== item.path ? 'opacity-30' : 'hover:text-accent-red')}
                    >
                      <span className="text-[12px] font-main font-normal opacity-50 tabular-nums w-6">{String(i + 1).padStart(2, '0')}</span>
                      <Scramble text={item.name} play={hover === item.path} />
                    </Link>
                  </motion.div>
                </div>
              ))}
            </nav>
            <div className="lg:col-span-4 py-6 flex flex-col gap-3 lg:justify-end lg:pb-10">
              <button onClick={toggleTheme} className="h-14 px-6 rounded-full border border-latte/25 flex items-center justify-between text-[14px] hover:bg-latte/10">
                {theme === 'dark' ? 'Latte mode' : 'Espresso mode'} {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={random} className="h-14 px-6 rounded-full border border-latte/25 flex items-center justify-between text-[14px] hover:bg-latte/10">
                Surprise me with a book <Dices className="w-4 h-4" />
              </button>
              {currentUser ? (
                <>
                  {me && <Link to={`/u/${me.username}`} onClick={onClose} className="h-14 px-6 rounded-full border border-latte/25 flex items-center justify-between text-[14px] hover:bg-latte/10">@{me.username} <ArrowUpRight className="w-4 h-4" /></Link>}
                  <button onClick={logout} className="h-14 px-6 rounded-full border border-latte/25 text-left text-[14px] text-accent-red">Sign out</button>
                </>
              ) : (
                <button onClick={loginWithGoogle} className="h-14 px-6 rounded-full bg-latte text-espresso text-[14px] font-medium">Sign in with Google</button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ---------------------------------------------------------------------
// Header: round menu button, a floating espresso pill split around the
// hanging bookmark badge, and round tool buttons on the right.
// ---------------------------------------------------------------------
const PillLink = ({ item, active, hovered, onHover }) => (
  <Link
    to={item.path}
    onMouseEnter={() => onHover(item.path)}
    className={cn('relative h-10 px-3.5 xl:px-4 rounded-full inline-flex items-center text-[12px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap transition-colors', active ? 'text-espresso' : 'text-latte')}
  >
    {active && <motion.span layoutId="pill-active" className="absolute inset-0 rounded-full bg-latte" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
    {hovered && !active && <motion.span layoutId="pill-hover" className="absolute inset-0 rounded-full bg-latte/10" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
    <span className="relative"><Scramble text={item.name} play={hovered && !active} /></span>
  </Link>
);

const Navbar = () => {
  const { currentUser } = useAuth();
  const pulse = usePulse();
  const isActive = useActive();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const [mega, setMega] = useState(false);
  const [bell, setBell] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hover, setHover] = useState(null);
  const [books, setBooks] = useState(null);
  const bellRef = useRef(null);
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });

  useEffect(() => { setMenu(false); setMega(false); setBell(false); setHidden(false); }, [pathname]);
  useEffect(() => { getCatalogueStats().then((s) => setBooks(s.books)).catch(() => {}); }, []);
  useEffect(() => {
    const close = (e) => bellRef.current && !bellRef.current.contains(e.target) && setBell(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    if (menu || mega || bell) return;
    if (y > 500 && y > prev + 6) setHidden(true);
    else if (y < prev - 6 || y < 500) setHidden(false);
  });

  const left = [{ name: 'Explore', path: '/explore' }, { name: 'Reels', path: '/reels' }];
  const right = currentUser
    ? [{ name: 'Feed', path: '/feed' }, { name: 'People', path: '/people' }, { name: 'Assistant', path: '/chat' }]
    : [{ name: 'Lists', path: '/lists' }, { name: 'Quiz', path: '/quiz' }, { name: 'Search', path: '/search' }];
  const items = NAV.filter((i) => !i.auth || currentUser);

  return (
    <>
      <motion.header
        className="fixed top-0 inset-x-0 z-[60] px-3 sm:px-5 pt-4 pointer-events-none"
        animate={{ y: hidden ? '-130%' : '0%' }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <div className="flex items-start gap-3 pointer-events-auto">
          <Round onClick={() => setMenu(true)} aria-label="Open menu"><Squiggle open={false} /></Round>

          {/* Centre pill */}
          <div className="relative flex-1 hidden lg:block" onMouseLeave={() => setHover(null)}>
            <div className="h-14 rounded-full bg-espresso/75 backdrop-blur-xl flex items-center justify-between px-2 overflow-hidden">
              <nav className="flex items-center">
                <button
                  onMouseEnter={() => { setMega(true); setHover(null); }}
                  onClick={() => setMega((m) => !m)}
                  className={cn('h-10 px-4 rounded-full inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-latte transition-colors', mega && 'bg-latte/10')}
                >
                  Discover <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-300', mega && 'rotate-180')} />
                </button>
                {left.map((i) => <PillLink key={i.path} item={i} active={isActive(i.path)} hovered={hover === i.path} onHover={(p) => { setHover(p); setMega(false); }} />)}
              </nav>
              <nav className="flex items-center">
                {right.map((i) => <PillLink key={i.path} item={i} active={isActive(i.path)} hovered={hover === i.path} onHover={(p) => { setHover(p); setMega(false); }} />)}
              </nav>
            </div>
            {/* reading progress inside the pill's bottom edge */}
            <motion.div className="absolute left-8 right-8 bottom-0 h-[2px] bg-accent-red origin-left rounded-full" style={{ scaleX: progress }} />
            <Badge />
            <MegaMenu open={mega} onClose={() => setMega(false)} />
          </div>

          {/* Mobile: brand in the middle */}
          <Link to="/home" className="lg:hidden flex-1 h-14 rounded-full bg-espresso/75 backdrop-blur-xl text-latte flex items-center justify-center gap-2.5">
            <LogoMark className="w-5 h-6" ribbon="#D8322B" /><Wordmark className="text-[17px]" />
          </Link>

          <div className="flex items-start gap-2">
            <Round onClick={openPalette} aria-label="Search" className="hidden sm:flex" title={books ? `Search ${books.toLocaleString()} books (⌘K)` : 'Search (⌘K)'}><Search className="w-[19px] h-[19px]" /></Round>
            {currentUser && (
              <>
                <div className="relative hidden sm:block" ref={bellRef}>
                  <Round onClick={() => setBell((b) => !b)} aria-label="Notifications">
                    <motion.span animate={pulse.notifications ? { rotate: [0, -14, 12, -8, 0] } : {}} transition={{ duration: 0.8, repeat: pulse.notifications ? Infinity : 0, repeatDelay: 4 }}>
                      <Bell className="w-[19px] h-[19px]" />
                    </motion.span>
                    <CountBadge n={pulse.notifications} />
                  </Round>
                  <NotificationsPanel open={bell} onClose={() => setBell(false)} />
                </div>
                <Link to="/messages" aria-label="Messages" className="relative w-14 h-14 rounded-full bg-espresso/75 backdrop-blur-xl text-latte flex items-center justify-center hover:bg-espresso transition-colors">
                  <MessageCircle className="w-[19px] h-[19px]" />
                  <CountBadge n={pulse.messages} />
                </Link>
              </>
            )}
            <span className="hidden sm:block"><Account /></span>
          </div>
        </div>
      </motion.header>

      <MenuOverlay open={menu} onClose={() => setMenu(false)} items={items} />
    </>
  );
};

export default Navbar;
