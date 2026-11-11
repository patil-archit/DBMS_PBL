import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity, BookMarked, BookOpen, Bot, ChevronDown, Home, List, LogOut, Menu, Search, Settings, Shield, User, Users, X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from './NeoButton';
import { Avatar } from './ui';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Search', path: '/search', icon: Search },
  { name: 'Lists', path: '/lists', icon: List },
  { name: 'Feed', path: '/feed', icon: Activity, auth: true },
  { name: 'People', path: '/people', icon: Users, auth: true },
  { name: 'Assistant', path: '/chat', icon: Bot, auth: true },
];

const Navbar = () => {
  const location = useLocation();
  const { currentUser, me, isStaff, loginWithGoogle, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    setMenuOpen(false);
    setUserOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const close = (e) => userRef.current && !userRef.current.contains(e.target) && setUserOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const items = NAV.filter((i) => !i.auth || currentUser);
  const isActive = (path) => location.pathname === path || (path !== '/' && location.pathname.startsWith(path));

  const userLinks = [
    { name: 'My Books', path: '/library', icon: BookMarked },
    ...(me ? [{ name: 'Profile', path: `/u/${me.username}`, icon: User }] : []),
    { name: 'Settings', path: '/settings', icon: Settings },
    ...(isStaff ? [{ name: me?.role === 'admin' ? 'Admin' : 'Moderation', path: '/admin', icon: Shield }] : []),
  ];

  return (
    <nav className="border-b-[3px] border-border bg-bg-base sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          <Link to="/" className="flex items-center group flex-shrink-0">
            <motion.div
              className="bg-accent-red border-2 border-border shadow-brutal p-2 mr-3 flex items-center justify-center"
              whileHover={{ rotate: -5, scale: 1.05 }}
            >
              <BookOpen className="w-6 h-6 text-white" strokeWidth={3} />
            </motion.div>
            <span className="font-extrabold text-2xl tracking-tight text-text-main leading-none">Book<span className="font-pixel text-3xl">Log</span></span>
          </Link>

          <div className="hidden lg:flex items-center space-x-1">
            {items.map(({ name, path, icon: Icon }) => {
              const active = isActive(path);
              return (
                <Link
                  key={name}
                  to={path}
                  className={cn('px-3 py-2 font-bold flex items-center transition-colors relative', active ? 'text-white' : 'text-text-muted hover:text-text-main')}
                >
                  {active && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-accent-teal border-2 border-border shadow-[2px_2px_0px_0px_#111] -z-10"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <Icon className="w-5 h-5 mr-2" />
                  {name}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => setUserOpen(!userOpen)}
                  aria-expanded={userOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 border-2 border-border bg-surface-white shadow-brutal px-2 py-1.5 font-bold"
                >
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="" className="w-8 h-8 border-2 border-border object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Avatar username={me?.username || '?'} size="w-8 h-8 text-sm" />
                  )}
                  <span className="hidden sm:inline max-w-[8rem] truncate">{me ? `@${me.username}` : '…'}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                {userOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-52 bg-surface-white border-[3px] border-border shadow-brutal-lg py-1 z-50">
                    {userLinks.map(({ name, path, icon: Icon }) => (
                      <Link key={name} role="menuitem" to={path} className="flex items-center gap-2 px-4 py-2 font-bold hover:bg-accent-teal hover:text-white">
                        <Icon className="w-4 h-4" /> {name}
                      </Link>
                    ))}
                    <button role="menuitem" onClick={logout} className="w-full flex items-center gap-2 px-4 py-2 font-bold hover:bg-accent-red hover:text-white border-t-2 border-border">
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="bg-accent-blue border-2 border-border shadow-brutal px-4 py-2 hover:shadow-brutal-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-bold uppercase tracking-wider"
              >
                Sign In
              </button>
            )}
            <button
              className="lg:hidden border-2 border-border bg-surface-white shadow-brutal p-2"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="lg:hidden border-t-[3px] border-border bg-surface-white">
          {[...items, ...(currentUser ? userLinks : [])].map(({ name, path, icon: Icon }) => (
            <Link
              key={name}
              to={path}
              className={cn('flex items-center gap-3 px-5 py-3 font-bold border-b-2 border-border', isActive(path) && 'bg-accent-teal text-white')}
            >
              <Icon className="w-5 h-5" /> {name}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
