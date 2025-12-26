
// Added React import to resolve 'Cannot find namespace React' error
import React, { useState, useEffect, useRef } from 'react';
import { getAsset } from '../services/db';
import { Loader2, Camera, AlertCircle } from 'lucide-react';

interface ItemImageProps {
  itemId: string;
  className?: string;
  alt?: string;
  type?: 'master' | 'thumb';
}

export const ItemImage: React.FC<ItemImageProps> = ({ itemId, className = "", alt = "", type = 'thumb' }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!itemId) return;
      
      setLoading(true);
      setError(false);
      
      try {
        // Cast type as 'master' | 'thumb' to fix string assignment error
        let blob = await getAsset(itemId, type as 'master' | 'thumb');
        if (!blob && type === 'thumb') {
            blob = await getAsset(itemId, 'master');
        }

        if (blob && isMounted) {
          const objectUrl = URL.createObjectURL(blob);
          if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
          currentUrlRef.current = objectUrl;
          setUrl(objectUrl);
        } else if (isMounted) {
          setError(true);
        }
      } catch (e) {
        console.error("Failed to load image asset", e);
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
    };
  }, [itemId, type]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-stone-50 ${className}`}>
        <Loader2 className="animate-spin text-stone-200" size={24} />
      </div>
    );
  }

  if (error || !url) {
    return (
      <div className={`flex flex-col items-center justify-center bg-stone-100 text-stone-300 ${className}`}>
        {error ? <AlertCircle size={24} className="opacity-20 mb-1" /> : <Camera size={24} className="opacity-20 mb-1" />}
        <span className="text-[10px] font-medium opacity-50">{error ? 'Load Error' : 'No Photo'}</span>
      </div>
    );
  }

  return <img src={url} alt={alt} className={`object-cover ${className}`} loading="lazy" />;
};
