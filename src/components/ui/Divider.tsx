import { useTheme, dividerClasses } from '@/theme';

interface DividerProps {
  className?: string;
  /** Orientation of the divider */
  orientation?: 'horizontal' | 'vertical';
  /** Add extra spacing around the divider */
  spacing?: 'none' | 'sm' | 'md' | 'lg';
}

const spacingClasses = {
  none: '',
  sm: 'my-2',
  md: 'my-4',
  lg: 'my-8',
};

const verticalSpacingClasses = {
  none: '',
  sm: 'mx-2',
  md: 'mx-4',
  lg: 'mx-8',
};

/**
 * Theme-aware divider component for visual separation.
 * Uses the enhanced theme color palette for consistent styling.
 */
export function Divider({
  className = '',
  orientation = 'horizontal',
  spacing = 'none',
}: DividerProps) {
  const { theme } = useTheme();

  if (orientation === 'vertical') {
    return (
      <div
        className={`border-l h-full ${dividerClasses[theme]} ${verticalSpacingClasses[spacing]} ${className}`}
        role="separator"
        aria-orientation="vertical"
      />
    );
  }

  return (
    <hr
      className={`border-t ${dividerClasses[theme]} ${spacingClasses[spacing]} ${className}`}
      role="separator"
      aria-orientation="horizontal"
    />
  );
}
