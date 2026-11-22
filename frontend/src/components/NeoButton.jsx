import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/*
  Editorial button: hairline or solid ink, with a fill that sweeps up from
  the bottom on hover and the label rolling to a second copy.
*/
const NeoButton = ({
  children,
  variant = 'primary',
  size = 'md',
  className,
  onClick,
  disabled,
  type = 'button',
  fullWidth = false,
  ...props
}) => {
  const variants = {
    primary: 'bg-text-main text-bg-base border-text-main',
    navy: 'bg-text-main text-bg-base border-text-main',
    secondary: 'bg-transparent text-text-main border-text-main',
    white: 'bg-transparent text-text-main border-border',
    red: 'bg-accent-red text-white border-accent-red',
  };
  const sweep = {
    primary: 'bg-accent-red',
    navy: 'bg-accent-red',
    red: 'bg-text-main',
    secondary: 'bg-text-main',
    white: 'bg-text-main',
  };
  const hoverText = {
    primary: 'group-hover:text-white',
    navy: 'group-hover:text-white',
    red: 'group-hover:text-bg-base',
    secondary: 'group-hover:text-bg-base',
    white: 'group-hover:text-bg-base',
  };
  const sizes = {
    sm: 'h-8 px-3.5 text-[12px]',
    md: 'h-11 px-5 text-[13px]',
    lg: 'h-14 px-7 text-[15px]',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative inline-flex items-center justify-center overflow-hidden rounded-full border font-medium tracking-tight select-none',
        'transition-[transform,opacity] duration-300 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-red',
        variants[variant] || variants.primary,
        sizes[size],
        fullWidth && 'w-full',
        disabled && 'opacity-40 pointer-events-none',
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-0 translate-y-[101%] rounded-[inherit] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-y-0',
          sweep[variant] || sweep.primary
        )}
      />
      <span className={cn('relative z-10 inline-flex items-center transition-colors duration-300', hoverText[variant])}>
        {children}
      </span>
    </button>
  );
};

export default NeoButton;
