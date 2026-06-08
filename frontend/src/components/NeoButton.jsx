import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

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
  const baseStyles = "relative inline-flex items-center justify-center font-bold transition-all border-brutal focus:outline-none";
  
  const variants = {
    primary: "bg-accent-red text-white hover:bg-red-500",
    secondary: "bg-accent-teal text-text-main hover:bg-teal-400",
    navy: "bg-accent-navy text-white hover:bg-gray-800",
    white: "bg-surface-white text-text-main hover:bg-gray-100",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-xl",
  };

  return (
    <motion.button
      type={type}
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        fullWidth ? 'w-full' : '',
        disabled ? 'opacity-50 cursor-not-allowed' : 'shadow-brutal hover:shadow-brutal-hover hover:translate-x-[2px] hover:translate-y-[2px]',
        className
      )}
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? {} : { x: 4, y: 4, boxShadow: "0px 0px 0px 0px #111111" }}
      {...props}
    >
      {children}
    </motion.button>
  );
};

export default NeoButton;
