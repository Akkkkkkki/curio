

import React, { useState, useEffect, useRef } from 'react';
import { getAsset } from '../services/db';
import { Loader2, Camera, AlertCircle } from 'lucide-react';

interface ItemImageProps {
  itemId: string;
  photoUrl?: string; // Can be a direct URL (relative/absolute/data) or the keyword 'asset'
  className?: string;
  alt?: string;
  type?: 'master' | 'thumb';
}

export const ItemImage: React.FC<ItemImageProps> = ({ itemId, photoUrl, className = "", alt = "", type = 'thumb' }) => {
  const [dbUrl, setDbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const defaultFallback = `${import.meta.env.BASE_URL}assets/sample-vinyl.jpg`;

  // If photoUrl is anything other than 'asset', it's a direct reference (URL or path)
  const isDirectSource = photoUrl && photoUrl !== 'asset' && photoUrl !== '';

  useEffect(() => {
    // Reset fallback/error when the source changes
    setFallbackSrc(null);
    setError(false);
  }, [photoUrl]);

  useEffect(() => {
    // If it's a direct source, we don't look in IndexedDB
    if (isDirectSource) {
      setDbUrl(null);
      setLoading(false);
      setError(false);
      return;
    }

    // If it's the 'asset' keyword, we fetch from IndexedDB
    if (itemId && photoUrl === 'asset') {
      let isMounted = true;
      const loadFromDB = async () => {
        setLoading(true);
        setError(false);
        try {
          // Fix: Assert 'type' as the expected union literal to prevent widening to 'string'
          let blob = await getAsset(itemId, type as 'master' | 'thumb');
          // Fallback to master if thumb is missing
          if ((!blob || blob.size === 0) && type === 'thumb') {
            blob = await getAsset(itemId, 'master');
          }

          if (blob && blob.size > 0 && isMounted) {
            const objectUrl = URL.createObjectURL(blob);
            const oldUrl = currentUrlRef.current;
            currentUrlRef.current = objectUrl;
            setDbUrl(objectUrl);
            if (oldUrl) {
              // Revoke previous URL to avoid memory leaks
              setTimeout(() => URL.revokeObjectURL(oldUrl), 200);
            }
          } else if (isMounted) {
            setError(true);
          }
        } catch (e) {
          console.error("Asset DB error:", itemId, e);
          if (isMounted) setError(true);
        } finally {
          if (isMounted) setLoading(false);
        }
      };

      loadFromDB();
      return () => { isMounted = false; };
    } else {
      setDbUrl(null);
      setLoading(false);
      setError(false);
    }
  }, [itemId, photoUrl, type, isDirectSource]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
    };
  }, []);

  const finalSrc = fallbackSrc || (isDirectSource ? photoUrl : dbUrl);

  if (loading && !finalSrc) {
    return (
      <div className={`flex items-center justify-center bg-stone-100 ${className}`}>
        <Loader2 className="animate-spin text-stone-300" size={24} />
      </div>
    );
  }

  // If there's an error OR we have no source and aren't loading, show placeholder
  if (error || (!finalSrc && !loading)) {
    return (
      <div className={`flex flex-col items-center justify-center bg-stone-100 text-stone-300 ${className} min-h-[100px]`}>
        {error ? <AlertCircle size={32} className="opacity-10 mb-2" /> : <Camera size={32} className="opacity-10 mb-2" />}
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">
          {error ? 'Image Error' : 'No Photo'}
        </span>
      </div>
    );
  }

  return (
    <img 
      src={finalSrc || ''} 
      alt={alt} 
      className={`object-cover ${className}`} 
      loading="lazy" 
      onError={() => {
        // Handle native browser load errors (e.g., 404 for relative paths)
        if (!fallbackSrc && isDirectSource) {
          setFallbackSrc(defaultFallback);
          setError(false);
          return;
        }
        setError(true);
      }}
    />
  );
};
