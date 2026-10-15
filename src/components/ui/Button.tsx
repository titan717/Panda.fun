import { PandaLoading } from './PandaLoading';
import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#9333ea] hover:bg-[#a855f7] active:bg-[#7e22ce] text-white font-semibold shadow-[0_2px_12px_rgba(147,51,234,0.35)] hover:shadow-[0_4px_16px_rgba(147,51,234,0.5)] border border-purple-400/20',
  secondary:
    'bg-[#181924] hover:bg-[#222433] active:bg-[#14151e] text-gray-200 hover:text-white font-medium border border-white/10 hover:border-white/20',
  ghost:
    'bg-transparent hover:bg-white/10 active:bg-white/5 text-gray-300 hover:text-white font-medium border border-transparent',
  outline:
    'bg-transparent hover:bg-white/5 active:bg-white/10 text-gray-200 hover:text-white font-medium border border-white/15 hover:border-white/30',
  danger:
    'bg-rose-600/90 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold shadow-[0_2px_12px_rgba(225,29,72,0.3)] border border-rose-400/20',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-1.5 rounded-lg min-h-[32px] gap-1.5',
  md: 'text-sm px-4 py-2 rounded-xl min-h-[40px] gap-2',
  lg: 'text-base px-6 py-2.5 rounded-xl min-h-[48px] gap-2.5',
  icon: 'p-2 rounded-xl min-h-[40px] min-w-[40px] sm:min-h-[42px] sm:min-w-[42px] flex items-center justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center select-none cursor-pointer
          transition-all duration-150 ease-out
          active:scale-[0.98]
          disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100
          kinoma-focus
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <>
            <PandaLoading state="working" label="" size={18} variant="compact" />
            {children && <span>{children}</span>}
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children && <span>{children}</span>}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
