import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 rounded-full disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-stone-800 text-stone-50 hover:bg-stone-700 shadow-sm',
    secondary: 'bg-amber-100 text-amber-900 hover:bg-amber-200',
    outline: 'border border-stone-300 text-stone-700 hover:bg-stone-50',
    ghost: 'text-stone-600 hover:bg-stone-100/50 hover:text-stone-900',
  };

  const sizes = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-5 py-2.5 gap-2',
    lg: 'text-base px-6 py-3 gap-2.5',
  };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {icon && (
        <span className="w-4 h-4 md:w-5 md:h-5 flex items-center justify-center shrink-0 [&>svg]:w-full [&>svg]:h-full">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
};
