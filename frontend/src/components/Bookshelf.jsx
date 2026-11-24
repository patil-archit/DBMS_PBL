import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CoverImage, EASE } from './ui';
import { coverPalette } from '../utils/colors';

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

// Readable ink for a spine colour
const inkFor = (rgb) => {
  const m = /(\d+)\D+(\d+)\D+(\d+)/.exec(rgb || '');
  if (!m) return '#fff';
  const [r, g, b] = m.slice(1).map(Number);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#2B1B14' : '#FCF3ED';
};

/** One spine. Thickness follows page count; colour is sampled from the cover once it scrolls into view. */
const Spine = ({ book, index }) => {
  const ref = useRef(null);
  const [color, setColor] = useState(null);
  const [open, setOpen] = useState(false);
  const h = hash(book.book_id || book.title);
  const width = Math.round(28 + Math.min(1, (book.page_count || 250) / 900) * 34);
  const height = 230 + (Math.abs(h) % 70);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { coverPalette(book.thumbnail, 2).then((p) => setColor(p[0])); io.disconnect(); }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [book.thumbnail]);

  const bg = color || `hsl(${Math.abs(h) % 360} 25% 35%)`;
  const ink = inkFor(color);
  return (
    <motion.div
      ref={ref}
      className="relative shrink-0 self-end"
      initial={{ y: 40, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, ease: EASE, delay: (index % 20) * 0.02 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <Link
        to={`/book/${encodeURIComponent(book.title)}`}
        data-cursor="Open"
        className="block relative overflow-hidden rounded-[2px] transition-[width,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[inset_-3px_0_6px_rgba(0,0,0,0.25),inset_3px_0_4px_rgba(255,255,255,0.12)]"
        style={{ width: open ? Math.round(height / 1.5) : width, height, background: bg, color: ink, transform: open ? 'translateY(-14px)' : 'none' }}
        title={`${book.title} by ${book.authors?.[0] || ''}`}
      >
        <span className={`absolute inset-0 flex flex-col items-center justify-between py-3 transition-opacity duration-300 ${open ? 'opacity-0' : 'opacity-100'}`}>
          <span className="w-[60%] h-px bg-current opacity-40" />
          <span className="[writing-mode:vertical-rl] rotate-180 caps font-semibold uppercase text-[11px] tracking-[0.02em] leading-none line-clamp-1 max-h-[75%] overflow-hidden whitespace-nowrap">
            {book.title}
          </span>
          <span className="[writing-mode:vertical-rl] rotate-180 text-[9px] opacity-70 whitespace-nowrap max-h-[22%] overflow-hidden">{book.authors?.[0]?.split(' ').pop()}</span>
        </span>
        <span className={`absolute inset-0 transition-opacity duration-500 ${open ? 'opacity-100' : 'opacity-0'}`}>
          {open && <CoverImage book={book} />}
        </span>
      </Link>
    </motion.div>
  );
};

/** Books on shelves: rows of spines, each standing on its own plank. */
const PER_SHELF = 14;
const Bookshelf = ({ books }) => {
  const rows = [];
  for (let i = 0; i < books.length; i += PER_SHELF) rows.push(books.slice(i, i + PER_SHELF));
  return (
    <div className="space-y-10">
      {rows.map((row, r) => (
        <div key={r}>
          <div className="flex flex-wrap items-end gap-[3px] px-3 min-h-[310px]">
            {row.map((b, i) => <Spine key={b.book_id} book={b} index={r * PER_SHELF + i} />)}
          </div>
          <div className="h-3 rounded-[2px] bg-text-main shadow-[0_14px_24px_-10px_rgba(0,0,0,0.5)]" />
          <div className="h-2 mx-2 bg-text-main/25 rounded-b-[2px]" />
        </div>
      ))}
    </div>
  );
};

export default Bookshelf;
