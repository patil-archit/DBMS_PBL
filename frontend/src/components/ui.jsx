import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from './NeoButton';
import { DogEar, Runner } from './Dogs';

export const EASE = [0.16, 1, 0.3, 1];

// ---------------------------------------------------------------------
// Reveal helpers
// ---------------------------------------------------------------------

/** Lines that slide up from behind a mask, one after another. */
export const RevealText = ({ children, as: Tag = 'span', className, delay = 0, stagger = 0.08, inView = false }) => {
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, margin: '-10% 0px' });
  const show = inView ? seen : true;
  const lines = React.Children.toArray(children);
  return (
    <Tag ref={ref} className={className}>
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
          <motion.span
            className="block will-change-transform"
            initial={{ y: '110%' }}
            animate={show ? { y: '0%' } : { y: '110%' }}
            transition={{ duration: 1.1, ease: EASE, delay: delay + i * stagger }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
};

/** Fades and lifts children when scrolled into view. */
export const FadeIn = ({ children, className, delay = 0, y = 24, as = 'div' }) => {
  const M = motion[as] || motion.div;
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8% 0px' }}
      transition={{ duration: 1, ease: EASE, delay }}
    >
      {children}
    </M>
  );
};

/** Counts up to a number once visible. */
export const CountUp = ({ value = 0, duration = 1.6, className, format = (n) => n.toLocaleString() }) => {
  const ref = useRef(null);
  const seen = useInView(ref, { once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen) return undefined;
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / (duration * 1000));
      setN(Math.round(value * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value, duration]);
  return <span ref={ref} className={className}>{format(n)}</span>;
};

// ---------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------
export const Page = ({ children, className }) => (
  <div className={cn('max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-10 pt-6 pb-24', className)}>{children}</div>
);

/** Section opener: a label row, then an oversized title that rises into view. */
export const PageTitle = ({ children, mark, kicker, right, className, animal, prop, seed = 3 }) => (
  <header className={cn('relative mb-12 md:mb-16', className)}>
    <p className="caps text-text-main mb-4">{kicker || mark || 'BookLog'}</p>
    <div className="flex flex-wrap items-end justify-between gap-6">
      <RevealText as="h1" className="font-display text-[clamp(3.6rem,10vw,9rem)]">
        {children}
      </RevealText>
      <div className="flex items-end gap-8 ml-auto">
        {right && <div className="pb-3">{right}</div>}
        {animal && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1, ease: EASE, delay: 0.2 }}
            className="hidden sm:block w-32 md:w-44 -mb-4">
            <DogEar animal={animal} prop={prop} seed={seed} body={false} />
          </motion.div>
        )}
      </div>
    </div>
  </header>
);

/** A filter pill: Bayon caps, red when on. */
export const Chip = ({ active, children, onClick, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'chip h-10 px-4 rounded-full border-2 text-[17px] leading-none whitespace-nowrap transition-colors duration-300',
      active ? 'bg-red border-red text-[#FBFBF4]' : 'border-border hover:border-text-main',
      className,
    )}
  >
    {children}
  </button>
);

export const SectionTitle = ({ children, mark, right, className }) => (
  <div className={cn('flex flex-wrap items-end justify-between gap-3 mb-6', className)}>
    <div className="flex items-baseline gap-4">
      {mark && <span className="caps opacity-70">{mark}</span>}
      <h2 className="font-display text-[clamp(2rem,3.6vw,3rem)]">{children}</h2>
    </div>
    {right}
  </div>
);

export const Card = ({ children, className, ...props }) => (
  <div className={cn('bg-surface-white rounded-[28px] p-6', className)} {...props}>
    {children}
  </div>
);

export const Spinner = ({ label = 'Fetching' }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-2 text-red">
    <Runner className="w-20" />
    <span className="caps">{label}…</span>
  </div>
);

export const Empty = ({ title, children }) => (
  <div className="rounded-[32px] bg-blush py-12 px-6 text-center flex flex-col items-center">
    <DogEar sleep body={false} ribbon={false} seed={title?.length || 9} className="w-28 mb-4" />
    <p className="font-display text-[clamp(2rem,4vw,3rem)] mb-2">{title}</p>
    {children && <div className="caps leading-snug max-w-md mx-auto">{children}</div>}
  </div>
);

export const ErrorBox = ({ children }) =>
  children ? (
    <div className="flex items-start gap-3 rounded-[20px] bg-red text-[#FBFBF4] px-5 py-3 text-[13px] mb-4">
      <span className="caps pt-px">Woof!</span>
      <span>{children}</span>
    </div>
  ) : null;

export const Tabs = ({ tabs, active, onChange }) => (
  <div className="flex flex-wrap gap-2 mb-10">
    {tabs.map((t) => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={cn(
          'relative h-11 px-5 rounded-full font-display text-[20px] transition-colors',
          active === t.id ? 'text-[#FBFBF4]' : 'text-text-main border-[1.5px] border-red/40 hover:border-red'
        )}
      >
        {active === t.id && (
          <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-red" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
        )}
        <span className="relative">{t.label}</span>
        {t.count !== undefined && <sup className="relative ml-1 font-main text-[10px]">{t.count}</sup>}
      </button>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// Modal: a sheet that rises from the bottom
// ---------------------------------------------------------------------
export const Modal = ({ open, onClose, title, children, wide }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.documentElement.classList.add('lenis-stopped');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('lenis-stopped');
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-[6px] flex items-end sm:items-center justify-center p-0 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
          data-lenis-prevent
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className={cn(
              'bg-bg-base text-text-main w-full max-h-[92vh] overflow-y-auto rounded-t-[32px] sm:rounded-[32px] shadow-brutal-lg',
              wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
            )}
          >
            <div className="flex items-center justify-between px-6 pt-6 pb-3 sticky top-0 z-10 bg-bg-base">
              <h3 className="font-display text-[clamp(1.8rem,3vw,2.4rem)] truncate pr-4">{title}</h3>
              <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full border-[1.5px] border-red flex items-center justify-center hover:bg-red hover:text-[#FBFBF4] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ---------------------------------------------------------------------
// Stars: display and half-star input (0.5 .. 5)
// ---------------------------------------------------------------------
const STAR = 'M12 2.5l2.9 6.2 6.6.7-5 4.5 1.4 6.6L12 17.2l-5.9 3.3 1.4-6.6-5-4.5 6.6-.7z';

const StarGlyph = ({ fill, size }) => (
  <span className={cn('relative inline-block', size)}>
    <svg viewBox="0 0 24 24" className={cn('absolute inset-0', size)}><path d={STAR} fill="currentColor" opacity="0.18" /></svg>
    <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
      <svg viewBox="0 0 24 24" className={size}><path d={STAR} fill="var(--color-accent-red)" /></svg>
    </span>
  </span>
);

const starFill = (value, i) => Math.max(0, Math.min(1, value - (i - 1)));

export const Stars = ({ value, size = 'w-3.5 h-3.5', className }) => {
  if (value === null || value === undefined) return null;
  return (
    <span className={cn('inline-flex items-center gap-px', className)} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => <StarGlyph key={i} fill={starFill(value, i)} size={size} />)}
    </span>
  );
};

export const StarInput = ({ value, onChange }) => {
  const [hover, setHover] = useState(null);
  const shown = hover ?? value ?? 0;
  return (
    <div className="flex items-center gap-4">
      <div className="flex" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="relative w-9 h-9">
            <span className="pointer-events-none absolute inset-0 transition-transform duration-300" style={{ transform: shown >= i - 0.5 ? 'scale(1.08)' : 'scale(1)' }}>
              <StarGlyph fill={starFill(shown, i)} size="w-9 h-9" />
            </span>
            <button type="button" aria-label={`${i - 0.5} stars`} className="absolute left-0 top-0 w-1/2 h-full" onMouseEnter={() => setHover(i - 0.5)} onClick={() => onChange(i - 0.5)} />
            <button type="button" aria-label={`${i} stars`} className="absolute right-0 top-0 w-1/2 h-full" onMouseEnter={() => setHover(i)} onClick={() => onChange(i)} />
          </span>
        ))}
      </div>
      <span className="display-num text-3xl w-14">{value ? value.toFixed(1) : '–'}</span>
      {value ? (
        <button type="button" className="label link-under" onClick={() => onChange(null)}>clear</button>
      ) : null}
    </div>
  );
};

// ---------------------------------------------------------------------
// Form fields: hairline boxes
// ---------------------------------------------------------------------
const fieldClass =
  'w-full px-5 py-3 bg-surface-white border-[1.5px] border-red/25 rounded-[22px] text-[14px] placeholder:text-text-muted focus:outline-none focus:border-red transition-colors';

export const Field = ({ label, hint, children }) => (
  <label className="block mb-5">
    <span className="caps block mb-2">{label}</span>
    {children}
    {hint && <span className="block text-[12px] text-text-muted mt-1.5">{hint}</span>}
  </label>
);

export const Input = (props) => <input {...props} className={cn(fieldClass, props.className)} />;
export const TextArea = (props) => <textarea rows={4} {...props} className={cn(fieldClass, props.className)} />;
export const Select = ({ children, ...props }) => (
  <select {...props} className={cn(fieldClass, 'py-2.5 appearance-none bg-[length:10px] bg-no-repeat bg-[right_14px_center]', props.className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238A8A8A' fill='none'/%3E%3C/svg%3E\")" }}>
    {children}
  </select>
);

export const Toggle = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-3 cursor-pointer select-none text-[14px]">
    <span className={cn('relative w-10 h-6 rounded-full border transition-colors', checked ? 'bg-red border-red' : 'border-red/30 bg-surface-white')}>
      <span className={cn('absolute top-[3px] w-4 h-4 rounded-full transition-all duration-300', checked ? 'left-[19px] bg-[#FBFBF4]' : 'left-[3px] bg-red/50')} />
    </span>
    <input type="checkbox" className="sr-only" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

// ---------------------------------------------------------------------
// People
// ---------------------------------------------------------------------
const AVATAR_TONES = ['#E33529', '#2B6786', '#C42B20', '#D96A8E', '#5A8FB3'];

export const Avatar = ({ username = '?', size = 'w-10 h-10 text-lg' }) => {
  const tone = AVATAR_TONES[[...username].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span className={cn('inline-flex items-center justify-center rounded-full font-display text-white uppercase flex-shrink-0', size)} style={{ background: tone }}>
      {username[0]}
    </span>
  );
};

export const UserLink = ({ username, className }) => (
  <Link to={`/u/${username}`} className={cn('font-medium link-draw', className)}>
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

/** Book cover image with a typographic fallback. */
export const CoverImage = ({ book, className, eager }) => {
  const [failed, setFailed] = useState(false);
  if (!book.thumbnail || failed) {
    return (
      <span className={cn('w-full h-full flex flex-col justify-between p-3 bg-text-main text-bg-base', className)}>
        <span className="font-serif text-[clamp(12px,1.4vw,20px)] leading-tight line-clamp-4">{book.title}</span>
        <span className="text-[9px] uppercase tracking-wider opacity-60 line-clamp-1">{book.authors?.[0]}</span>
      </span>
    );
  }
  return (
    <img
      src={book.thumbnail}
      alt={book.title}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
      onLoad={(e) => { if (e.currentTarget.naturalWidth < 10) setFailed(true); }}
      className={cn('w-full h-full object-cover', className)}
    />
  );
};

// Small book cover thumbnail linking to the book
export const Cover = ({ book, className = 'w-14 h-20' }) => (
  <Link to={`/book/${encodeURIComponent(book.title)}`} data-cursor="View" className={cn('block rounded-[2px] overflow-hidden flex-shrink-0 shadow-cover bg-surface-white', className)}>
    <CoverImage book={book} />
  </Link>
);
