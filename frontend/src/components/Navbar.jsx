import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { ArrowUpRight, Bell, Dices, MessageCircle, Moon, Search, Sun } from 'lucide-react';
import { cn } from './NeoButton';
import { Avatar, EASE } from './ui';
import { DogEar, Paw, Runner } from './Dogs';
import { openPalette, useTheme } from './shell';
import { CountBadge, NotificationsPanel, usePulse } from './social';
import { useAuth } from '../contexts/AuthContext';
import { getRandomBook } from '../services/api';

export const NAV = [
  { name: 'Home', path: '/home' },
  { name: 'Explore', path: '/explore' },
  { name: 'Flips', path: '/flips' },
  { name: 'Lists', path: '/lists' },
  { name: 'Reader quiz', path: '/quiz' },
  { name: 'Search', path: '/search' },
  { name: 'Feed', path: '/feed', auth: true },
  { name: 'People', path: '/people', auth: true },
  { name: 'Messages', path: '/messages', auth: true },
  { name: 'Assistant', path: '/chat', auth: true },
  { name: 'My books', path: '/library', auth: true },
];

const useActive = () => {
  const { pathname } = useLocation();
  return (path) => pathname === path || pathname.startsWith(`${path}/`);
};

/** Runner + stacked wordmark, like a shop sign. */
export const Brand = ({ className }) => (
  <Link to="/home" aria-label="BookLog home" className={cn('group flex items-center gap-2.5 text-text-main', className)}>
    <Runner className="w-[64px]" run={false} />
    <span className="font-display text-[15px] leading-[0.82] tracking-[0.02em]">Book<br />Log</span>
  </Link>
);

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
      <button onClick={loginWithGoogle} className="h-11 px-6 rounded-full bg-red text-[#FBFBF4] caps hover:bg-red-deep transition-colors whitespace-nowrap">
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
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" className="w-11 h-11 rounded-full border-[1.5px] border-red flex items-center justify-center overflow-hidden hover:scale-105 transition-transform">
        {currentUser.photoURL
          ? <img src={currentUser.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          : <Avatar username={me?.username || '?'} size="w-full h-full text-base" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="absolute right-0 mt-3 w-64 origin-top-right bg-surface-white border-[1.5px] border-red text-text-main rounded-[26px] p-2 z-50 shadow-brutal-lg"
          >
            {me && <p className="px-4 pt-3 pb-2 caps text-text-muted">@{me.username}</p>}
            {links.map((l) => (
              <Link key={l.name} role="menuitem" to={l.path} className="flex items-center justify-between px-4 py-2.5 rounded-full caps hover:bg-red hover:text-[#FBFBF4] transition-colors">
                {l.name} <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            ))}
            <button role="menuitem" onClick={logout} className="w-full text-left px-4 py-2.5 mt-1 rounded-full caps hover:bg-red hover:text-[#FBFBF4] transition-colors">Sign out</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RoundIcon = ({ children, className, as: Tag = 'button', ...props }) => (
  <Tag className={cn('relative w-11 h-11 rounded-full border-[1.5px] border-text-main text-text-main flex items-center justify-center hover:bg-red hover:border-red hover:text-[#FBFBF4] transition-colors', className)} {...props}>
    {children}
  </Tag>
);

// ---------------------------------------------------------------------
// Full-screen menu: pink sheet, giant caps, a dog peeking up from below
// ---------------------------------------------------------------------
const MenuOverlay = ({ open, onClose, items }) => {
  const isActive = useActive();
  const navigate = useNavigate();
  const { me, currentUser, loginWithGoogle, logout } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const random = async () => { onClose(); try { const b = await getRandomBook(); navigate(`/book/${encodeURIComponent(b.title)}`); } catch { /* ignore */ } };
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] bg-pink text-red flex flex-col overflow-hidden"
          initial={{ clipPath: 'circle(0% at 50% 0%)' }}
          animate={{ clipPath: 'circle(150% at 50% 0%)' }}
          exit={{ clipPath: 'circle(0% at 50% 0%)' }}
          transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
          data-lenis-prevent
        >
          <div className="flex items-center justify-between px-5 sm:px-8 h-20 shrink-0">
            <button onClick={onClose} className="caps text-[14px] link-under">Close</button>
            <Brand />
            <span className="w-12" />
          </div>
          <div className="flex-1 grid content-start lg:grid-cols-12 gap-6 px-5 sm:px-8 overflow-y-auto pb-10">
            <nav className="lg:col-span-8 flex flex-col">
              {items.map((item, i) => (
                <div key={item.path} className="overflow-hidden">
                  <motion.div initial={{ y: '110%', rotate: 4 }} animate={{ y: 0, rotate: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.18 + i * 0.035 }}>
                    <Link
                      to={item.path}
                      onClick={onClose}
                      className={cn('group flex items-center gap-4 font-display text-[clamp(2.6rem,7.4vw,6rem)] leading-[0.95] transition-colors',
                        isActive(item.path) ? 'text-red-deep' : 'hover:text-red-deep')}
                    >
                      <span className="caps text-[12px] w-7 opacity-60">{String(i + 1).padStart(2, '0')}</span>
                      <span className="transition-transform duration-500 group-hover:translate-x-4">{item.name}</span>
                      <Paw className="w-8 h-8 opacity-0 -rotate-12 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500" />
                    </Link>
                  </motion.div>
                </div>
              ))}
            </nav>
            <div className="lg:col-span-4 flex flex-col gap-2.5 lg:justify-start lg:pt-6">
              <button onClick={toggleTheme} className="h-14 px-6 rounded-full border-[1.5px] border-red flex items-center justify-between caps hover:bg-red hover:text-[#FBFBF4] transition-colors">
                {theme === 'dark' ? 'Day reading' : 'Night reading'} {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button onClick={random} className="h-14 px-6 rounded-full border-[1.5px] border-red flex items-center justify-between caps hover:bg-red hover:text-[#FBFBF4] transition-colors">
                Surprise me with a book <Dices className="w-4 h-4" />
              </button>
              {currentUser ? (
                <>
                  {me && <Link to={`/u/${me.username}`} onClick={onClose} className="h-14 px-6 rounded-full border-[1.5px] border-red flex items-center justify-between caps hover:bg-red hover:text-[#FBFBF4] transition-colors">@{me.username} <ArrowUpRight className="w-4 h-4" /></Link>}
                  <button onClick={logout} className="h-14 px-6 rounded-full border-[1.5px] border-red text-left caps hover:bg-red hover:text-[#FBFBF4] transition-colors">Sign out</button>
                </>
              ) : (
                <button onClick={loginWithGoogle} className="h-14 px-6 rounded-full bg-red text-[#FBFBF4] caps">Sign in with Google</button>
              )}
            </div>
          </div>
          <motion.div className="absolute -bottom-24 right-[6%] w-[min(42vw,340px)] pointer-events-none hidden md:block" initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}>
            <DogEar animal="rabbit" prop="bow" seed={21} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ---------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------
const TOP_LINKS = [
  { name: 'Explore', path: '/explore' },
  { name: 'Flips', path: '/flips' },
  { name: 'Lists', path: '/lists' },
  { name: 'Quiz', path: '/quiz' },
];
const USER_LINKS = [
  { name: 'Feed', path: '/feed' },
  { name: 'People', path: '/people' },
  { name: 'Assistant', path: '/chat' },
];

const NO_FLOAT = ['/flips', '/messages', '/chat', '/quiz'];

const Navbar = () => {
  const { currentUser } = useAuth();
  const pulse = usePulse();
  const isActive = useActive();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const bellRef = useRef(null);
  const { scrollY } = useScroll();

  useEffect(() => { setMenu(false); setBell(false); setHidden(false); }, [pathname]);
  useEffect(() => {
    const close = (e) => bellRef.current && !bellRef.current.contains(e.target) && setBell(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setSolid(y > 40);
    if (menu || bell) return;
    if (y > 400 && y > prev + 6) setHidden(true);
    else if (y < prev - 6 || y < 400) setHidden(false);
  });

  const links = currentUser ? [...TOP_LINKS, ...USER_LINKS] : TOP_LINKS;
  const items = NAV.filter((i) => !i.auth || currentUser);

  return (
    <>
      <motion.header
        className={cn('fixed top-0 inset-x-0 z-[60] transition-colors duration-500', solid ? 'bg-bg-base/85 backdrop-blur-xl' : 'bg-transparent')}
        animate={{ y: hidden ? '-110%' : '0%' }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="h-[76px] px-4 sm:px-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center gap-5">
            <button onClick={() => setMenu(true)} className="caps text-[14px] text-text-main link-under xl:hidden">Menu</button>
            <Brand className="hidden xl:flex" />
          </div>

          <nav className="hidden xl:flex items-center gap-1">
            {links.map((l) => (
              <Link key={l.path} to={l.path} className="group relative px-3.5 py-2 caps text-text-main">
                <span className={cn('relative transition-opacity', isActive(l.path) ? 'opacity-100' : 'opacity-80 group-hover:opacity-100')}>{l.name}</span>
                {isActive(l.path)
                  ? <motion.span layoutId="nav-dot" className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-1.5 h-1.5 rounded-full bg-red" />
                  : <Paw className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-3.5 h-3.5 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300" />}
              </Link>
            ))}
            <button onClick={() => setMenu(true)} className="px-3.5 py-2 caps text-text-main opacity-80 hover:opacity-100">More</button>
          </nav>
          <Brand className="xl:hidden justify-self-center" />

          <div className="flex items-center justify-end gap-2">
            <RoundIcon onClick={openPalette} aria-label="Search books" className="hidden sm:flex"><Search className="w-[18px] h-[18px]" /></RoundIcon>
            {currentUser && (
              <>
                <div className="relative hidden sm:block" ref={bellRef}>
                  <RoundIcon onClick={() => setBell((b) => !b)} aria-label="Notifications">
                    <motion.span animate={pulse.notifications ? { rotate: [0, -14, 12, -8, 0] } : {}} transition={{ duration: 0.8, repeat: pulse.notifications ? Infinity : 0, repeatDelay: 4 }}>
                      <Bell className="w-[18px] h-[18px]" />
                    </motion.span>
                    <CountBadge n={pulse.notifications} />
                  </RoundIcon>
                  <NotificationsPanel open={bell} onClose={() => setBell(false)} />
                </div>
                <RoundIcon as={Link} to="/messages" aria-label="Messages" className="hidden sm:flex">
                  <MessageCircle className="w-[18px] h-[18px]" />
                  <CountBadge n={pulse.messages} />
                </RoundIcon>
              </>
            )}
            <Account />
          </div>
        </div>
      </motion.header>

      {/* Floating call to action, bottom right */}
      <AnimatePresence>
        {!NO_FLOAT.some((p) => pathname.startsWith(p)) && (
          <motion.button
            key="float"
            onClick={openPalette}
            initial={{ y: 120, rotate: -8 }}
            animate={{ y: 0, rotate: -6 }}
            exit={{ y: 120 }}
            whileHover={{ rotate: 0, scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18, delay: 0.6 }}
            className="fixed right-4 bottom-4 sm:right-6 sm:bottom-6 z-[70] h-14 pl-3 pr-6 rounded-full bg-red text-[#FBFBF4] flex items-center gap-2 font-display text-[22px] shadow-[0_14px_30px_-12px_rgba(196,43,32,0.7)]"
          >
            <Runner className="w-12" color="#FBFBF4" detail="var(--color-red)" />
            Find a book
          </motion.button>
        )}
      </AnimatePresence>

      <MenuOverlay open={menu} onClose={() => setMenu(false)} items={items} />
    </>
  );
};

export default Navbar;
