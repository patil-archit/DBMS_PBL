import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUp } from 'lucide-react';
import { DogEar } from './Dogs';
import { openPalette, scrollToTop } from './shell';
import { EASE } from './ui';

const COLS = [
  ['Find a book', [['Explore', '/explore'], ['Flips', '/flips'], ['Reader quiz', '/quiz'], ['Search', '/search'], ['Lists', '/lists']]],
  ['Your diary', [['My books', '/library'], ['Messages', '/messages'], ['Feed', '/feed'], ['People', '/people'], ['Settings', '/settings']]],
  ['Under the hood', [['PostgreSQL · source of truth'], ['Neo4j · social graph'], ['MongoDB · logs & chat'], ['FastAPI · React']]],
];

const Footer = () => (
  <footer className="relative bg-red text-[#FBFBF4] overflow-hidden">
    <div className="px-5 sm:px-8 pt-16 md:pt-24">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <h2 className="font-display text-[clamp(3rem,9vw,8.5rem)]">Got a book<br />on your mind?</h2>
        <button onClick={openPalette} className="h-16 px-9 rounded-full bg-[#FBFBF4] text-red font-display text-[28px] hover:scale-105 hover:-rotate-3 transition-transform duration-500">
          Find it here
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 pb-14 border-b border-[#FBFBF4]/25">
        {COLS.map(([title, links]) => (
          <div key={title}>
            <p className="caps opacity-60 mb-4">{title}</p>
            <ul className="space-y-1.5">
              {links.map(([name, to]) => (
                <li key={name} className="caps">
                  {to ? <Link to={to} className="link-draw">{name}</Link> : <span className="opacity-90">{name}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="caps opacity-60 mb-4">The project</p>
          <p className="caps leading-relaxed">
            RV College of Engineering<br />Department of ISE<br />DBMS · CD252IA<br />Archit Patil &amp; Bhavya Chawat
          </p>
        </div>
      </div>
    </div>

    {/* giant wordmark with a dog asleep on it */}
    <div className="relative px-3 select-none pt-[6vw]" aria-hidden="true">
      <motion.div
        className="absolute left-[58%] top-0 w-[19vw] min-w-[120px]"
        initial={{ y: '60%' }}
        whileInView={{ y: '0%' }}
        viewport={{ once: true }}
        transition={{ duration: 1.2, ease: EASE }}
      >
        <DogEar animal="cat" sleep body={false} ribbon={false} seed={33} cover="#2B6786" />
      </motion.div>
      <p className="relative font-display text-[27vw] leading-[0.74] translate-y-[8%] text-center">BookLog</p>
    </div>

    <div className="absolute left-5 sm:left-8 bottom-4 caps opacity-70">© {new Date().getFullYear()} BookLog · a student project</div>
    <button onClick={() => scrollToTop(false)} className="absolute right-5 bottom-4 sm:right-8 w-11 h-11 rounded-full border-[1.5px] border-[#FBFBF4] flex items-center justify-center hover:bg-[#FBFBF4] hover:text-red transition-colors" aria-label="Back to top">
      <ArrowUp className="w-4 h-4" />
    </button>
  </footer>
);

export default Footer;
