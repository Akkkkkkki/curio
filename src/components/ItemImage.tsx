import React, { useState, useEffect, useRef, useMemo } from 'react';
import { extractCurioAssetPath, getAsset, getEnhancedAsset } from '../services/db';
import { Loader2, Camera, AlertCircle } from 'lucide-react';
import { useTranslation } from '../i18n';

interface ItemImageProps {
  itemId: string;
  photoUrl?: string; // Can be a direct URL (relative/absolute/data) or the keyword 'asset'
  enhancedPath?: string;
  collectionId?: string;
  className?: string;
  alt?: string;
  type?: 'display' | 'original' | 'enhanced';
}

export const ItemImage: React.FC<ItemImageProps> = ({
  itemId,
  photoUrl,
  enhancedPath,
  collectionId,
  className = '',
  alt = '',
  type = 'display',
}) => {
  const { t } = useTranslation();
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
          let blob: Blob | null = null;

          // Handle enhanced type with fallback chain: enhanced -> display -> original
          if (type === 'enhanced') {
            blob = await getEnhancedAsset(itemId, { enhancedPath, collectionId });
            if (!blob || blob.size === 0) {
              const [displayBlob, originalBlob] = await Promise.all([
                getAsset(itemId, 'display', remoteAssetPath || undefined, collectionId),
                getAsset(itemId, 'original', remoteAssetPath || undefined, collectionId),
              ]);
              blob = displayBlob || originalBlob;
            }
          } else {
            blob = await getAsset(
              itemId,
              type as 'original' | 'display',
              remoteAssetPath || undefined,
              collectionId,
            );
            // Fallback to original if display is missing
            if ((!blob || blob.size === 0) && type === 'display') {
              blob = await getAsset(itemId, 'original', remoteAssetPath || undefined, collectionId);
            }
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
  }, [itemId, photoUrl, type, isDirectSource, remoteAssetPath, collectionId, enhancedPath]);

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
          {error ? t('imageError') : t('noPhoto')}
        </span>
      </div>
    );
  }

  // Prevent React error #310: never pass empty string or invalid URL to img src
  if (!finalSrc || finalSrc.trim() === '') {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-stone-100 text-stone-300 ${className} min-h-[100px]`}
      >
        <Camera size={32} className="opacity-10 mb-2" />
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-30">
          {t('noPhoto')}
        </span>
      </div>
    );
  }

  return (
    <img
      src={finalSrc}
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
