import React from 'react';
import { useTheme, frameClasses, frameInnerClasses } from '@/theme';

interface ExhibitFrameProps {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export function ExhibitFrame({ children, className = '', size = 'md' }: ExhibitFrameProps) {
  const { theme } = useTheme();
  const padding = size === 'sm' ? 'p-1.5 sm:p-2' : 'p-2 sm:p-3';
  const outerRadius = size === 'sm' ? 'rounded-sm' : 'rounded';
  const innerRadius = size === 'sm' ? 'rounded-[2px]' : 'rounded-sm';

  return (
    <div
      className={`
        border
        ${frameClasses[theme]}
        ${padding}
        ${outerRadius}
        ${className}
      `}
    >
      <div className={`overflow-hidden ${frameInnerClasses[theme]} ${innerRadius}`}>{children}</div>
    </div>
  );
}
