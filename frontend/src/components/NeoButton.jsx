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
    primary: 'bg-red text-[#FBFBF4] border-red',
    navy: 'bg-steel text-[#FBFBF4] border-steel',
    secondary: 'bg-transparent text-red border-red',
    white: 'bg-transparent text-text-main border-red/30',
    red: 'bg-red text-[#FBFBF4] border-red',
  };
  const sweep = {
    primary: 'bg-red-deep',
    navy: 'bg-red',
    red: 'bg-red-deep',
    secondary: 'bg-red',
    white: 'bg-red',
  };
  const hoverText = {
    primary: 'group-hover:text-[#FBFBF4]',
    navy: 'group-hover:text-[#FBFBF4]',
    red: 'group-hover:text-[#FBFBF4]',
    secondary: 'group-hover:text-[#FBFBF4]',
    white: 'group-hover:text-[#FBFBF4]',
  };
  const sizes = {
    sm: 'h-9 px-4 text-[17px]',
    md: 'h-11 px-6 text-[20px]',
    lg: 'h-14 px-8 text-[25px]',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative inline-flex items-center justify-center overflow-hidden rounded-full border-[1.5px] font-display leading-none select-none',
        'transition-[transform,opacity] duration-500 hover:-rotate-2 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-red',
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
