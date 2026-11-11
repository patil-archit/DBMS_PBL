import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Star, X } from 'lucide-react';
import { cn } from './NeoButton';

// ---------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------
export const Page = ({ children, className }) => (
  <div className={cn('max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-12', className)}>{children}</div>
);

export const PageTitle = ({ children, mark = '_', color = 'text-accent-red', right }) => (
  <div className="mb-10 border-b-4 border-border pb-6 flex flex-wrap items-end justify-between gap-4">
    <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-text-main flex items-center">
      <span className={cn('font-pixel mr-3', color)}>{mark}</span>
      {children}
    </h1>
    {right}
  </div>
);

export const SectionTitle = ({ children, mark = '#', color = 'text-accent-teal', right }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
    <h2 className="text-2xl md:text-3xl font-black text-text-main flex items-center gap-2">
      <span className={cn('font-pixel', color)}>{mark}</span> {children}
    </h2>
    {right}
  </div>
);

export const Card = ({ children, className, ...props }) => (
  <div className={cn('bg-surface-white border-[3px] border-border shadow-brutal p-5', className)} {...props}>
    {children}
  </div>
);

export const Spinner = ({ label }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    <Loader2 className="w-10 h-10 animate-spin text-accent-red" />
    {label && <p className="font-pixel text-xl tracking-widest uppercase">{label}</p>}
  </div>
);

export const Empty = ({ title, children }) => (
  <div className="bg-surface-white border-[3px] border-dashed border-border p-10 text-center">
    <p className="font-pixel text-2xl text-text-muted uppercase tracking-widest mb-2">{title}</p>
    {children && <div className="text-lg font-medium text-text-muted">{children}</div>}
  </div>
);

export const ErrorBox = ({ children }) =>
  children ? (
    <div className="bg-accent-red/10 border-[3px] border-accent-red p-4 font-bold text-accent-red mb-4">{children}</div>
  ) : null;

export const Tabs = ({ tabs, active, onChange }) => (
  <div className="flex flex-wrap gap-3 mb-8">
    {tabs.map((t) => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={cn(
          'px-4 py-2 border-[3px] border-border font-bold transition-all shadow-brutal hover:shadow-brutal-hover hover:translate-x-[2px] hover:translate-y-[2px]',
          active === t.id ? 'bg-accent-navy text-white' : 'bg-surface-white text-text-main'
        )}
      >
        {t.label}
        {t.count !== undefined && <span className="ml-2 font-pixel text-lg opacity-80">{t.count}</span>}
      </button>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------
export const Modal = ({ open, onClose, title, children, wide }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className={cn(
              'bg-bg-base border-[4px] border-border shadow-brutal-lg w-full max-h-[92vh] overflow-y-auto',
              wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
            )}
          >
            <div className="flex items-center justify-between bg-accent-navy text-white px-5 py-3 border-b-[3px] border-border sticky top-0 z-10">
              <h3 className="font-black text-xl truncate pr-4">{title}</h3>
              <button onClick={onClose} aria-label="Close" className="p-1 hover:text-accent-red">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ---------------------------------------------------------------------
// Stars: display and half-star input (0.5 .. 5)
// ---------------------------------------------------------------------
const StarGlyph = ({ fill, size }) => (
  <span className={cn('relative inline-block', size)}>
    <Star className={cn('absolute inset-0 text-text-main', size)} strokeWidth={2} />
    <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
      <Star className={cn('text-accent-red fill-accent-red', size)} strokeWidth={2} />
    </span>
  </span>
);

const starFill = (value, i) => Math.max(0, Math.min(1, value - (i - 1)));

export const Stars = ({ value, size = 'w-4 h-4', className }) => {
  if (value === null || value === undefined) return null;
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <StarGlyph key={i} fill={starFill(value, i)} size={size} />)}
    </span>
  );
};

export const StarInput = ({ value, onChange }) => {
  const [hover, setHover] = useState(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="relative w-9 h-9">
            <span className="pointer-events-none absolute inset-0"><StarGlyph fill={starFill(shown, i)} size="w-9 h-9" /></span>
            <button
              type="button"
              aria-label={`${i - 0.5} stars`}
              className="absolute left-0 top-0 w-1/2 h-full"
              onMouseEnter={() => setHover(i - 0.5)}
              onClick={() => onChange(i - 0.5)}
            />
            <button
              type="button"
              aria-label={`${i} stars`}
              className="absolute right-0 top-0 w-1/2 h-full"
              onMouseEnter={() => setHover(i)}
              onClick={() => onChange(i)}
            />
          </span>
        ))}
      </div>
      <span className="font-pixel text-2xl w-12">{value ? value.toFixed(1) : '–'}</span>
      {value ? (
        <button type="button" className="text-sm font-bold underline text-text-muted" onClick={() => onChange(null)}>
          clear
        </button>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------
const fieldClass =
  'w-full px-4 py-3 bg-surface-white border-[3px] border-border font-medium focus:outline-none focus:shadow-brutal-hover';

export const Field = ({ label, hint, children }) => (
  <label className="block mb-4">
    <span className="block font-bold mb-1">{label}</span>
    {children}
    {hint && <span className="block text-sm text-text-muted mt-1">{hint}</span>}
  </label>
);

export const Input = (props) => <input {...props} className={cn(fieldClass, props.className)} />;
export const TextArea = (props) => <textarea rows={4} {...props} className={cn(fieldClass, props.className)} />;
export const Select = ({ children, ...props }) => (
  <select {...props} className={cn(fieldClass, 'py-2.5', props.className)}>
    {children}
  </select>
);

export const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer select-none font-bold">
    <input type="checkbox" className="w-5 h-5 accent-accent-red" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

// ---------------------------------------------------------------------
// People
// ---------------------------------------------------------------------
const AVATAR_COLORS = ['bg-accent-red', 'bg-accent-teal', 'bg-accent-blue', 'bg-accent-navy'];

export const Avatar = ({ username = '?', size = 'w-10 h-10 text-lg' }) => {
  const color = AVATAR_COLORS[[...username].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return (
    <span className={cn('inline-flex items-center justify-center border-2 border-border font-black text-white uppercase flex-shrink-0', color, size)}>
      {username[0]}
    </span>
  );
};

export const UserLink = ({ username, className }) => (
  <Link to={`/u/${username}`} className={cn('font-bold hover:text-accent-red hover:underline', className)}>
    @{username}
  </Link>
);

export const timeAgo = (iso) => {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
};

export const formatDate = (d) =>
  d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

// Small book cover thumbnail linking to the book
export const Cover = ({ book, className = 'w-14 h-20' }) => (
  <Link to={`/book/${encodeURIComponent(book.title)}`} className={cn('block border-2 border-border bg-bg-base overflow-hidden flex-shrink-0', className)}>
    {book.thumbnail ? (
      <img src={book.thumbnail} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
    ) : (
      <span className="w-full h-full flex items-center justify-center font-pixel text-xs p-1 text-center">{book.title}</span>
    )}
  </Link>
);
