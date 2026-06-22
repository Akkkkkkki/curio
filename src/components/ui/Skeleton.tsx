import React from 'react';
import { Loader2 } from 'lucide-react';

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

// Deep-link routes (/collection/:id, /collection/:id/item/:itemId) reuse
// HomeScreen's "Restoring the archives…" affordance while `isLoading` is
// true, so a hard reload on a shared link no longer bounces back to Home
// before the cloud fetch resolves (CUR-118). The label is passed in so the
// component stays i18n-free.
export const CollectionScreenSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div
    className="space-y-8 sm:space-y-10 animate-in fade-in duration-500"
    data-testid="collection-screen-skeleton"
  >
    <div className="text-center pt-4">
      <Loader2 className="text-stone-300 animate-spin mx-auto mb-4" size={24} />
      <p className="text-stone-400 font-serif italic text-sm">{label}</p>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
      <ItemCardSkeleton />
      <ItemCardSkeleton />
      <ItemCardSkeleton />
      <ItemCardSkeleton />
    </div>
  </div>
);

export const ItemDetailSkeleton: React.FC<{ label: string }> = ({ label }) => (
  <div
    className="flex flex-col items-center justify-center py-16 sm:py-24 animate-in fade-in duration-500"
    data-testid="item-detail-skeleton"
  >
    <Loader2 className="text-stone-300 animate-spin mb-4" size={24} />
    <p className="text-stone-400 font-serif italic text-sm">{label}</p>
  </div>
);
