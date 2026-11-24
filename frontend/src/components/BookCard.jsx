import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from './NeoButton';
import { CoverImage } from './ui';
import { logClick } from '../services/api';

/*
  A cover that tilts toward the pointer in 3D with a moving light sheen,
  then a quiet caption: title, author, rating and (for recommendations) why.
  `colorScheme` is accepted for older callers and ignored.
*/
// eslint-disable-next-line no-unused-vars
const BookCard = ({ book, showScore = false, colorScheme, source, index, className }) => {
  const ref = useRef(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [9, -9]), { stiffness: 180, damping: 18 });
  const ry = useSpring(useTransform(mx, [0, 1], [-11, 11]), { stiffness: 180, damping: 18 });
  const glareX = useTransform(mx, [0, 1], ['0%', '100%']);
  const glare = useTransform(glareX, (x) => `radial-gradient(circle at ${x} 20%, rgba(255,255,255,0.35), transparent 55%)`);

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  };
  const reset = () => { mx.set(0.5); my.set(0.5); };

  return (
    <Link
      to={`/book/${encodeURIComponent(book.title)}`}
      className={cn('group block', className)}
     
      onClick={() => book.book_id && source && logClick(book.book_id, source)}
    >
      <div className="[perspective:900px]">
        <motion.div
          ref={ref}
          onMouseMove={onMove}
          onMouseLeave={reset}
          style={{ rotateX: rx, rotateY: ry, transformStyle: 'preserve-3d' }}
          className="relative aspect-[2/3] rounded-r-[5px] rounded-l-[2px] overflow-hidden shadow-cover bg-surface-white transition-shadow duration-500 group-hover:shadow-[0_40px_60px_-25px_rgba(120,20,12,0.55)]"
        >
          <CoverImage book={book} className="transition-transform duration-[1.2s] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]" />
          {/* spine shading */}
          <span className="pointer-events-none absolute inset-y-0 left-0 w-[7%] bg-gradient-to-r from-black/25 via-white/10 to-transparent" />
          <motion.span className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: glare }} />
          {showScore && book.score !== undefined && (
            <span className="absolute top-2 right-2 rounded-full bg-black/70 text-white text-[10px] px-2 py-0.5 backdrop-blur">
              {Math.round(book.score * 100)}%
            </span>
          )}
        </motion.div>
      </div>

      <div className="pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-[22px] leading-[0.95] line-clamp-2" title={book.title}>
            {index !== undefined && <span className="mr-1.5 opacity-60">{String(index + 1).padStart(2, '0')}</span>}
            {book.title}
          </h3>
          {book.average_rating ? (
            <span className="caps whitespace-nowrap tabular-nums pt-0.5">★ {Number(book.average_rating).toFixed(1)}</span>
          ) : null}
        </div>
        <p className="caps opacity-75 mt-1 line-clamp-1">{book.authors?.length ? book.authors.join(', ') : 'Unknown author'}</p>
        {book.reason && (
          <div className="mt-3 rounded-[18px] bg-blush px-4 py-3">
            <p className="caps text-[10px]">Why this pick</p>
            <p className="text-[12.5px] leading-[1.45] mt-1">{book.reason}</p>
          </div>
        )}
      </div>
    </Link>
  );
};

export default BookCard;
