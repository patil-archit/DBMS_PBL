import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from './NeoButton';

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
export const PageTitle = ({ children, mark, kicker, right, className }) => (
  <header className={cn('mb-12 md:mb-16', className)}>
    <div className="flex items-center justify-between gap-4 border-t border-border pt-3 mb-6 md:mb-10">
      <span className="label">{kicker || (mark ? `( ${mark} )` : 'BookLog')}</span>
      <span className="label hidden sm:block">Index · {new Date().getFullYear()}</span>
    </div>
    <div className="flex flex-wrap items-end justify-between gap-6">
      <RevealText as="h1" className="font-wide font-medium text-[clamp(2.4rem,7vw,6.5rem)] leading-[0.92] tracking-[-0.02em]">
        {children}
      </RevealText>
      {right && <div className="pb-2">{right}</div>}
    </div>
  </header>
);

export const SectionTitle = ({ children, mark, right, className }) => (
  <div className={cn('flex flex-wrap items-end justify-between gap-3 mb-6 border-t border-border pt-3', className)}>
    <div className="flex items-baseline gap-4">
      {mark && <span className="label">{mark}</span>}
      <h2 className="font-wide font-medium text-[17px] md:text-[19px]">{children}</h2>
    </div>
    {right}
  </div>
);

export const Card = ({ children, className, ...props }) => (
  <div className={cn('bg-surface-white border border-border rounded-[4px] p-5', className)} {...props}>
    {children}
  </div>
);

export const Spinner = ({ label = 'Loading' }) => (
  <div className="flex items-center justify-center py-20 gap-3">
    <span className="relative w-2 h-2">
      <span className="absolute inset-0 rounded-full bg-accent-red animate-ping" />
      <span className="absolute inset-0 rounded-full bg-accent-red" />
    </span>
    <span className="label">{label}…</span>
  </div>
);

export const Empty = ({ title, children }) => (
  <div className="border-t border-border py-16 text-center">
    <p className="font-serif italic text-3xl md:text-4xl mb-3">{title}</p>
    {children && <div className="text-text-muted max-w-md mx-auto">{children}</div>}
  </div>
);

export const ErrorBox = ({ children }) =>
  children ? (
    <div className="flex items-start gap-3 border-l-2 border-accent-red bg-accent-red/8 px-4 py-3 text-[13px] mb-4">
      <span className="label !text-accent-red pt-px">Error</span>
      <span>{children}</span>
    </div>
  ) : null;

export const Tabs = ({ tabs, active, onChange }) => (
  <div className="flex flex-wrap gap-x-8 gap-y-2 mb-10 border-b border-border">
    {tabs.map((t) => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={cn(
          'relative pb-3 -mb-px font-wide text-[12px] transition-colors',
          active === t.id ? 'text-text-main' : 'text-text-muted hover:text-text-main'
        )}
      >
        {t.label}
        {t.count !== undefined && <sup className="ml-1 font-main normal-case text-[10px]">{t.count}</sup>}
        {active === t.id && (
          <motion.span layoutId="tab-underline" className="absolute left-0 right-0 bottom-0 h-px bg-text-main" transition={{ duration: 0.5, ease: EASE }} />
        )}
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
              'bg-bg-base text-text-main w-full max-h-[92vh] overflow-y-auto rounded-t-[14px] sm:rounded-[10px] shadow-brutal-lg',
              wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
            )}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border sticky top-0 z-10 bg-bg-base">
              <div>
                <span className="label block mb-1">BookLog</span>
                <h3 className="font-wide font-medium text-[15px] truncate pr-4">{title}</h3>
              </div>
              <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-text-main hover:text-bg-base transition-colors">
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
  'w-full px-4 py-3 bg-surface-white border border-border rounded-[6px] text-[14px] placeholder:text-text-muted focus:outline-none focus:border-text-main transition-colors';

export const Field = ({ label, hint, children }) => (
  <label className="block mb-5">
    <span className="label block mb-2">{label}</span>
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
    <span className={cn('relative w-10 h-6 rounded-full border transition-colors', checked ? 'bg-text-main border-text-main' : 'border-border bg-surface-white')}>
      <span className={cn('absolute top-[3px] w-4 h-4 rounded-full transition-all duration-300', checked ? 'left-[19px] bg-bg-base' : 'left-[3px] bg-text-muted')} />
    </span>
    <input type="checkbox" className="sr-only" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

// ---------------------------------------------------------------------
// People
// ---------------------------------------------------------------------
const AVATAR_TONES = ['#D8322B', '#2F5D50', '#2B1B14', '#7A6A55', '#3E5A7A'];

export const Avatar = ({ username = '?', size = 'w-10 h-10 text-lg' }) => {
  const tone = AVATAR_TONES[[...username].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <span className={cn('inline-flex items-center justify-center rounded-full font-serif italic text-white uppercase flex-shrink-0', size)} style={{ background: tone }}>
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
        <span className="font-serif italic text-[clamp(12px,1.4vw,20px)] leading-tight line-clamp-4">{book.title}</span>
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
