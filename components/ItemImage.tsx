import React, { useState, useEffect, useRef, useMemo } from 'react';
import { extractCurioAssetPath, getAsset } from '../services/db';
import { Loader2, Camera, AlertCircle } from 'lucide-react';

interface ItemImageProps {
  itemId: string;
  photoUrl?: string; // Can be a direct URL (relative/absolute/data) or the keyword 'asset'
  collectionId?: string;
  className?: string;
  alt?: string;
  type?: 'display' | 'original';
}

export const ItemImage: React.FC<ItemImageProps> = ({
  itemId,
  photoUrl,
  collectionId,
  className = '',
  alt = '',
  type = 'display',
}) => {
  const [dbUrl, setDbUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fallbackSrc, setFallbackSrc] = useState<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const defaultFallback = `${import.meta.env.BASE_URL}assets/sample-vinyl.jpg`;
  const remoteAssetPath = useMemo(() => {
    if (!photoUrl) return null;
    if (photoUrl === 'asset') return null;
    const extracted = extractCurioAssetPath(photoUrl);
    if (extracted) return extracted;
    if (
      photoUrl.startsWith('http') ||
      photoUrl.startsWith('data:') ||
      photoUrl.startsWith('blob:') ||
      photoUrl.startsWith('/')
    ) {
      return null;
    }
    if (
      photoUrl.endsWith('.jpg') ||
      photoUrl.endsWith('.jpeg') ||
      photoUrl.endsWith('.png') ||
      photoUrl.endsWith('.webp')
    ) {
      return photoUrl;
    }
    return null;
  }, [photoUrl]);
  const resolvedPhotoUrl = useMemo(() => {
    if (!photoUrl || photoUrl === 'asset' || remoteAssetPath) return null;
    if (
      photoUrl.startsWith('http') ||
      photoUrl.startsWith('data:') ||
      photoUrl.startsWith('blob:') ||
      photoUrl.startsWith('/')
    ) {
      return photoUrl;
    }
    return `${import.meta.env.BASE_URL}${photoUrl}`;
  }, [photoUrl]);

  // If photoUrl is anything other than 'asset', it's a direct reference (URL or path)
  const isDirectSource =
    resolvedPhotoUrl && resolvedPhotoUrl !== 'asset' && resolvedPhotoUrl !== '';

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
    if (itemId && (photoUrl === 'asset' || remoteAssetPath)) {
      let isMounted = true;
      const loadFromDB = async () => {
        setLoading(true);
        setError(false);
        try {
          let blob = await getAsset(
            itemId,
            type as 'original' | 'display',
            remoteAssetPath || undefined,
            collectionId,
          );
          // Fallback to original if display is missing
          if ((!blob || blob.size === 0) && type === 'display') {
            blob = await getAsset(itemId, 'original', remoteAssetPath || undefined, collectionId);
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
          console.error('Asset DB error:', itemId, e);
          if (isMounted) setError(true);
        } finally {
          if (isMounted) setLoading(false);
        }
      };

      loadFromDB();
      return () => {
        isMounted = false;
      };
    } else {
      setDbUrl(null);
      setLoading(false);
      setError(false);
    }
  }, [itemId, photoUrl, type, isDirectSource, remoteAssetPath, collectionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
    };
  }, []);

  const finalSrc = fallbackSrc || (isDirectSource ? resolvedPhotoUrl : dbUrl);

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
      <div
        className={`flex flex-col items-center justify-center bg-stone-100 text-stone-300 ${className} min-h-[100px]`}
      >
        {error ? (
          <AlertCircle size={32} className="opacity-10 mb-2" />
        ) : (
          <Camera size={32} className="opacity-10 mb-2" />
        )}
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
