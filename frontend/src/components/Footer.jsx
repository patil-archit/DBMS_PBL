import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowUpRight } from 'lucide-react';
import { LogoMark } from './Logo';
import { LiveClock, openPalette, scrollToTop } from './shell';
import { RevealText } from './ui';

const COLS = [
  {
    title: 'Find something to read',
    links: [
      { name: 'Explore the catalogue', to: '/explore' },
      { name: 'Book reels & takes', to: '/reels' },
      { name: 'Reader quiz', to: '/quiz' },
      { name: 'Search with typos allowed', to: '/search' },
      { name: 'Ask the assistant', to: '/chat' },
      { name: 'Ranked lists', to: '/lists' },
    ],
  },
  {
    title: 'Keep a diary',
    links: [
      { name: 'My books', to: '/library' },
      { name: 'Messages', to: '/messages' },
      { name: 'Friends’ activity', to: '/feed' },
      { name: 'People & taste match', to: '/people' },
      { name: 'Settings & export', to: '/settings' },
    ],
  },
  {
    title: 'Under the hood',
    links: [
      { name: 'Project cover page', to: '/' },
      { name: 'PostgreSQL · source of truth', to: null },
      { name: 'Neo4j · social graph', to: null },
      { name: 'MongoDB · logs & chat', to: null },
      { name: 'FastAPI · React', to: null },
    ],
  },
];

const Footer = () => (
  <footer className="relative bg-forest text-latte overflow-hidden">
    <div className="px-5 sm:px-8 lg:px-10 pt-16 md:pt-24">
      <div className="flex flex-wrap items-end justify-between gap-8 mb-16 md:mb-24">
        <div>
          <p className="text-[11px] opacity-50 mb-6">( Come read with us )</p>
          <RevealText inView as="h2" className="font-statement text-[clamp(3.2rem,10vw,9rem)]">
            <span>Your next</span>
            <span><span className="font-serif normal-case font-light text-[0.45em] align-middle mr-2">favourite</span>book</span>
            <span className="text-accent-red">is in here.</span>
          </RevealText>
        </div>
        <button onClick={openPalette} className="group flex items-center gap-4 border-b border-white/30 pb-2 text-[clamp(1rem,2vw,1.4rem)]">
          Start searching
          <span className="w-10 h-10 rounded-full bg-accent-red flex items-center justify-center transition-transform duration-500 group-hover:rotate-45">
            <ArrowUpRight className="w-5 h-5" />
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-14 border-b border-white/10">
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="text-[11px] opacity-50 mb-4">{c.title}</p>
            <ul className="space-y-1.5">
              {c.links.map((l) => (
                <li key={l.name} className="text-[13px]">
                  {l.to ? <Link to={l.to} className="link-draw">{l.name}</Link> : <span className="opacity-80">{l.name}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="text-[11px] opacity-50 mb-4">Local time</p>
          <p className="text-[13px]"><LiveClock /></p>
          <p className="text-[11px] opacity-50 mt-6 mb-2">Project</p>
          <p className="text-[13px] leading-snug">RVCE · DBMS CD252IA<br />Archit Patil &amp; Bhavya Chawat</p>
        </div>
      </div>
    </div>

    {/* Oversized wordmark, cropped by the page edge */}
    <div className="relative px-3 select-none" aria-hidden="true">
      <div className="flex items-end gap-[2vw] leading-[0.75] translate-y-[14%]">
        <LogoMark className="w-[12vw] h-auto text-latte mb-[1vw]" />
        <span className="font-statement text-[26vw]">BOOKLOG</span>
      </div>
    </div>

    <div className="absolute right-5 bottom-5 sm:right-8">
      <button onClick={() => scrollToTop(false)} className="w-11 h-11 rounded-full border border-white/25 flex items-center justify-center hover:bg-[#EDD1BD] hover:text-[#2B1B14] transition-colors" aria-label="Back to top">
        <ArrowUp className="w-4 h-4" />
      </button>
    </div>
  </footer>
);

export default Footer;
