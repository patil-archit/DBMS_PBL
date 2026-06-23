import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Network, Search, User, BookMarked, Home, LogOut, Activity, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from './NeoButton';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const location = useLocation();
  const { currentUser, loginWithGoogle, logout } = useAuth();

  const navItems = [
    { name: 'Home', path: '/', icon: <Home className="w-5 h-5" /> },
    { name: 'Search', path: '/search', icon: <Search className="w-5 h-5" /> },
    { name: 'Graph Traversal', path: '/graph', icon: <Network className="w-5 h-5" /> },
    { name: 'Simulation', path: '/simulation', icon: <Activity className="w-5 h-5" /> },
    { name: 'My Library', path: '/library', icon: <BookMarked className="w-5 h-5" /> },
    { name: 'Friends', path: '/friends', icon: <Users className="w-5 h-5" /> },
  ];

  return (
    <nav className="border-b-[3px] border-border bg-bg-base sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo */}
          <Link to="/" className="flex items-center group">
            <motion.div 
              className="bg-accent-red border-2 border-border shadow-brutal p-2 mr-4 flex items-center justify-center"
              whileHover={{ rotate: -5, scale: 1.05 }}
              whileTap={{ scale: 0.95, boxShadow: "0px 0px 0px 0px #111" }}
            >
              <Network className="w-6 h-6 text-white" strokeWidth={3} />
            </motion.div>
            <div className="flex flex-col">
              <span className="font-extrabold text-2xl tracking-tight text-text-main leading-none">Biblio<span className="font-pixel text-3xl">Graph</span></span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    "px-4 py-2 font-bold flex items-center transition-colors border-2 border-transparent relative group",
                    isActive ? "text-text-main" : "text-text-muted hover:text-text-main"
                  )}
                >
                  {isActive && (
                    <motion.div 
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-accent-teal border-2 border-border shadow-[2px_2px_0px_0px_#111] -z-10"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="mr-2">{item.icon}</span>
                  <span className={isActive ? "text-white" : ""}>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* User Profile / Auth */}
          <div className="flex items-center space-x-4">
            {currentUser ? (
              <div className="flex items-center space-x-3">
                <span className="font-pixel text-sm hidden sm:inline-block">{currentUser.displayName?.split(' ')[0]}</span>
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="Profile" className="w-10 h-10 border-2 border-border shadow-brutal object-cover" />
                ) : (
                  <div className="w-10 h-10 bg-accent-blue border-2 border-border shadow-brutal flex items-center justify-center">
                    <User className="w-6 h-6 text-text-main" strokeWidth={2.5} />
                  </div>
                )}
                <button 
                  onClick={logout}
                  title="Sign Out"
                  className="flex items-center justify-center bg-accent-red border-2 border-border shadow-brutal p-2 hover:shadow-brutal-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all focus:outline-none"
                >
                  <LogOut className="w-5 h-5 text-white" strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button 
                onClick={loginWithGoogle}
                className="flex items-center justify-center bg-accent-blue border-2 border-border shadow-brutal p-2 px-4 hover:shadow-brutal-hover hover:translate-x-[2px] hover:translate-y-[2px] transition-all focus:outline-none font-bold uppercase tracking-wider"
              >
                Sign In
              </button>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
};

export default Navbar;
