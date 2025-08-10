import React from 'react';
import { cn } from '../../utils/cn';

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'link' | 'destructive';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  default: 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-600 hover:to-primary-700 focus:ring-primary-500/30 shadow-soft hover:shadow-soft-lg hover:scale-105 active:scale-95',
  outline: 'border border-gray-300/60 dark:border-gray-600/60 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm hover:bg-gray-50 dark:hover:bg-gray-700/80 text-gray-700 dark:text-gray-300 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-soft',
  ghost: 'bg-transparent hover:bg-gray-100/60 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-300 hover:shadow-soft backdrop-blur-sm',
  link: 'bg-transparent underline-offset-4 hover:underline text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300',
  destructive: 'bg-gradient-to-r from-error-500 to-error-600 text-white hover:from-error-600 hover:to-error-700 focus:ring-error-500/30 shadow-soft hover:shadow-soft-lg hover:scale-105 active:scale-95',
};

const sizeStyles: Record<ButtonSize, string> = {
  default: 'h-10 py-2 px-4',
  sm: 'h-8 px-3 text-sm',
  lg: 'h-12 px-6',
  icon: 'h-10 w-10 p-0',
};

export function Button({
  variant = 'default',
  size = 'default',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded-xl inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none disabled:transform-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}