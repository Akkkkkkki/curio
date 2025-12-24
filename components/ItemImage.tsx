import React, { useState, useEffect } from 'react';
import { getAsset } from '../services/db';
import { Loader2, Camera } from 'lucide-react';

interface ItemImageProps {
  itemId: string;
  className?: string;
  alt?: string;
}

export const ItemImage: React.FC<ItemImageProps> = ({ itemId, className = "", alt = "" }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;

    const load = async () => {
      try {
        const blob = await getAsset(itemId);
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        }
      } catch (e) {
        console.error("Failed to load image asset", e);
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [itemId]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-stone-50 ${className}`}>
        <Loader2 className="animate-spin text-stone-200" size={24} />
      </div>
    );
  }

  if (!url) {
    return (
      <div className={`flex flex-col items-center justify-center bg-stone-100 text-stone-300 ${className}`}>
        <Camera size={24} className="opacity-20 mb-1" />
        <span className="text-[10px] font-medium opacity-50">No Photo</span>
      </div>
    );
  }

  return <img src={url} alt={alt} className={`object-cover ${className}`} />;
};