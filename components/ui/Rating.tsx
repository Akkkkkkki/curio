import { Star } from 'lucide-react';
import { useTheme, ratingColorClasses, ratingEmptyClasses } from '@/theme';

interface RatingProps {
  /** Current rating value (0-5) */
  value: number;
  /** Maximum rating value */
  max?: number;
  /** Size of the stars */
  size?: 'sm' | 'md' | 'lg';
  /** Whether the rating is interactive */
  onChange?: (value: number) => void;
  /** Additional classes */
  className?: string;
}

const sizeClasses = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

/**
 * Theme-aware rating component with muted amber stars.
 * Uses the enhanced theme color palette for consistent styling.
 */
export function Rating({ value, max = 5, size = 'md', onChange, className = '' }: RatingProps) {
  const { theme } = useTheme();
  const isInteractive = !!onChange;

  return (
    <div
      className={`flex items-center gap-0.5 ${className}`}
      role="img"
      aria-label={`${value} out of ${max} stars`}
    >
      {Array.from({ length: max }, (_, i) => {
        const isFilled = i < value;
        const starClasses = isFilled
          ? `${ratingColorClasses[theme]} fill-current`
          : ratingEmptyClasses[theme];

        return (
          <button
            key={i}
            type="button"
            disabled={!isInteractive}
            onClick={() => onChange?.(i + 1)}
            className={`${isInteractive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} disabled:cursor-default`}
            aria-label={`${i + 1} star${i === 0 ? '' : 's'}`}
          >
            <Star className={`${sizeClasses[size]} ${starClasses}`} />
          </button>
        );
      })}
    </div>
  );
}
