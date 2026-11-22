import React from 'react';
import { motion } from 'framer-motion';
import { cn } from './NeoButton';

/*
  BookLog mark: a solid "B" split by a thin slit into a spine and a block of
  pages, with a red bookmark ribbon dropping out of the bottom bowl.
  Works at 16px (favicon) and 400px (intro).
*/
export const LogoMark = ({ className, animate = false, ribbon = '#D8322B' }) => {
  const draw = animate
    ? { initial: { pathLength: 0 }, animate: { pathLength: 1 } }
    : {};
  const t = (delay) => (animate ? { duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] } : undefined);
  return (
    <svg viewBox="0 0 48 56" className={cn('block', className)} aria-hidden="true" fill="none">
      {/* spine + bowls */}
      <motion.path
        d="M8 4h16a10 10 0 0 1 0 20H8z"
        fill="currentColor"
        {...(animate ? { initial: { opacity: 0, x: -6 }, animate: { opacity: 1, x: 0 } } : {})}
        transition={t(0.05)}
      />
      <motion.path
        d="M8 26h19a11 11 0 0 1 0 22H8z"
        fill="currentColor"
        {...(animate ? { initial: { opacity: 0, x: -6 }, animate: { opacity: 1, x: 0 } } : {})}
        transition={t(0.15)}
      />
      {/* the slit that splits spine from pages */}
      <motion.path d="M14.5 2V50" stroke="var(--color-bg-base)" strokeWidth="2.4" {...draw} transition={t(0.35)} />
      {/* bookmark ribbon */}
      <motion.path
        d="M30 40h7v16l-3.5-3.6L30 56z"
        fill={ribbon}
        {...(animate ? { initial: { scaleY: 0 }, animate: { scaleY: 1 } } : {})}
        style={{ originY: 0 }}
        transition={t(0.6)}
      />
    </svg>
  );
};

export const Wordmark = ({ className }) => (
  <span className={cn('font-wide font-semibold leading-none tracking-tight inline-flex items-start', className)}>
    BOOKLOG<sup className="text-[0.45em] ml-[0.1em] mt-[0.05em] font-medium">®</sup>
  </span>
);

const Logo = ({ className, markClass = 'w-6 h-7' }) => (
  <span className={cn('inline-flex items-center gap-2.5', className)}>
    <LogoMark className={markClass} />
    <Wordmark className="text-[15px]" />
  </span>
);

export default Logo;
