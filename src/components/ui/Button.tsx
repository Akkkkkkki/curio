import React from 'react';
import { useTheme } from '@/theme';
import { AppTheme } from '@/types';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  /**
   * Override the theme used to style this button. Useful for buttons that
   * sit on a surface whose color is pinned regardless of the app theme
   * (e.g. the white export sheet in ExportModal).
   */
  theme?: AppTheme;
}

const variantClasses: Record<AppTheme, Record<Variant, string>> = {
  gallery: {
    primary: 'bg-stone-800 text-stone-50 hover:bg-stone-700 shadow-sm',
    secondary: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
    outline: 'border border-stone-300 text-stone-700 hover:bg-stone-50',
    ghost: 'text-stone-600 hover:bg-stone-100/50 hover:text-stone-900',
  },
  vault: {
    primary: 'bg-[#D4A574] text-stone-900 hover:bg-[#E0B585] shadow-vault',
    secondary: 'bg-[#D4A574]/15 text-[#E0B585] hover:bg-[#D4A574]/25',
    outline: 'border border-white/20 text-white hover:bg-white/5',
    ghost: 'text-stone-300 hover:bg-white/5 hover:text-white',
  },
  atelier: {
    primary: 'bg-[#8B5A2B] text-white hover:bg-[#73481F] shadow-atelier',
    secondary: 'bg-[#8B5A2B]/15 text-[#73481F] hover:bg-[#8B5A2B]/25',
    outline: 'border border-[#D4C9B8] text-[#3D3530] hover:bg-[#EDE4D3]',
    ghost: 'text-[#6F6257] hover:bg-[#EDE4D3]/60 hover:text-[#3D3530]',
  },
};

const focusRingClasses: Record<AppTheme, string> = {
  gallery: 'focus:ring-amber-500/40',
  vault: 'focus:ring-[#D4A574]/40',
  atelier: 'focus:ring-[#8B5A2B]/40',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, variant = 'primary', size = 'md', className = '', icon, theme: themeProp, ...props },
  ref,
) {
  const { theme: contextTheme } = useTheme();
  const theme = themeProp ?? contextTheme;

  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98]';

  const sizes = {
    sm: 'text-xs px-4 py-2 gap-1.5',
    md: 'text-sm px-6 py-3 gap-2',
    lg: 'text-base px-8 py-4 gap-2.5',
  };

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${focusRingClasses[theme]} ${variantClasses[theme][variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon && (
        <span className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
});
