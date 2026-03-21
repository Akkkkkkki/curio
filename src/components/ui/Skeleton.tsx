import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
  count?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rect',
  count = 1,
}) => {
  const baseClass = 'animate-pulse bg-stone-200 rounded';
  const variantClass =
    variant === 'circle' ? 'rounded-full' : variant === 'text' ? 'h-4 rounded' : 'rounded-xl';

  if (count === 1) {
    return <div className={`${baseClass} ${variantClass} ${className}`} />;
  }

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${baseClass} ${variantClass} ${className}`} />
      ))}
    </>
  );
};

export const CollectionCardSkeleton: React.FC = () => (
  <div className="rounded-[2rem] border border-stone-100 p-6 space-y-4 bg-white/50">
    <div className="flex items-center gap-3">
      <Skeleton variant="circle" className="w-10 h-10" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-2/3 h-5" />
        <Skeleton variant="text" className="w-1/3 h-3" />
      </div>
    </div>
    <Skeleton className="w-full h-32" />
    <div className="flex gap-2">
      <Skeleton variant="text" className="w-16 h-6" />
      <Skeleton variant="text" className="w-20 h-6" />
    </div>
  </div>
);

export const ItemCardSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-stone-100 overflow-hidden bg-white/50">
    <Skeleton className="w-full aspect-square" />
    <div className="p-3 space-y-2">
      <Skeleton variant="text" className="w-3/4 h-4" />
      <Skeleton variant="text" className="w-1/2 h-3" />
    </div>
  </div>
);
