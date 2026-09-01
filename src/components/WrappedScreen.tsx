import React, { useMemo, useRef, useState } from 'react';
import { Download, Share2, Sparkles } from 'lucide-react';
import { toPng } from 'html-to-image';
import type { UserCollection } from '../types';
import { buildWrappedSummary } from '../utils/wrapped';
import { ItemImage } from './ItemImage';
import { Button } from './ui/Button';

interface WrappedScreenProps {
  collections: UserCollection[];
  year?: number;
}

const monthLabel = (year: number, month: number) =>
  new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(year, month, 1)),
  );

export const WrappedScreen: React.FC<WrappedScreenProps> = ({
  collections,
  year = new Date().getUTCFullYear(),
}) => {
  const summary = useMemo(() => buildWrappedSummary(collections, year), [collections, year]);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const renderPng = async () => {
    if (!cardRef.current) return null;
    return toPng(cardRef.current, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#f5efe4',
    });
  };

  const download = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await renderPng();
      if (!dataUrl) return;
      const anchor = document.createElement('a');
      anchor.download = `curio-wrapped-${year}.png`;
      anchor.href = dataUrl;
      anchor.click();
    } finally {
      setIsExporting(false);
    }
  };

  const share = async () => {
    setIsExporting(true);
    try {
      const dataUrl = await renderPng();
      if (!dataUrl) return;
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `curio-wrapped-${year}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `My ${year} Curio Wrapped` });
        return;
      }
      await download();
    } finally {
      setIsExporting(false);
    }
  };

  if (summary.itemsAddedThisYear === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Sparkles className="mx-auto mb-4 text-amber-600" aria-hidden="true" />
        <h1 className="font-serif text-4xl text-stone-900">Your {year} museum is waiting</h1>
        <p className="mx-auto mt-3 max-w-xl text-stone-600">
          Add a few pieces this year and Curio will turn the record into a quiet retrospective.
        </p>
      </section>
    );
  }

  const standoutCollection = summary.standoutItem
    ? collections.find((collection) => collection.id === summary.standoutItem?.collectionId)
    : undefined;

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#8B5A2B]">
            Year in objects
          </p>
          <h1 className="mt-2 font-serif text-4xl text-[#3D3530] sm:text-5xl">
            Your {year} museum
          </h1>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button
            variant="secondary"
            onClick={download}
            disabled={isExporting}
            icon={<Download size={16} />}
          >
            Save image
          </Button>
          <Button onClick={share} disabled={isExporting} icon={<Share2 size={16} />}>
            Share
          </Button>
        </div>
      </div>

      <div
        ref={cardRef}
        className="overflow-hidden rounded-[2rem] border border-[#D4C9B8] bg-[#F5EFE4] p-5 text-[#3D3530] shadow-xl sm:p-10"
      >
        <header className="border-b border-[#D4C9B8] pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#8B5A2B]">
            Curio · {year}
          </p>
          <h2 className="mt-4 max-w-2xl font-serif text-4xl leading-tight sm:text-6xl">
            {summary.itemsAddedThisYear} objects joined your museum.
          </h2>
          <p className="mt-4 max-w-xl font-serif text-lg italic text-[#6F6257]">
            Across {summary.totalCollections}{' '}
            {summary.totalCollections === 1 ? 'collection' : 'collections'}, your archive grew
            through the pieces you chose to remember.
          </p>
        </header>

        <div className="grid gap-5 py-6 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/55 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8B5A2B]">
              Added
            </p>
            <p className="mt-2 font-serif text-4xl">{summary.itemsAddedThisYear}</p>
            <p className="mt-1 text-sm text-[#6F6257]">new objects in {year}</p>
          </div>
          <div className="rounded-2xl bg-white/55 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8B5A2B]">
              Busiest chapter
            </p>
            <p className="mt-2 font-serif text-2xl">
              {summary.busiestMonth ? monthLabel(year, summary.busiestMonth.month) : '—'}
            </p>
            <p className="mt-1 text-sm text-[#6F6257]">
              {summary.busiestMonth?.itemCount ?? 0} objects catalogued
            </p>
          </div>
          <div className="rounded-2xl bg-white/55 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8B5A2B]">
              Museum size
            </p>
            <p className="mt-2 font-serif text-4xl">{summary.totalItems}</p>
            <p className="mt-1 text-sm text-[#6F6257]">objects in your archive now</p>
          </div>
        </div>

        {summary.standoutItem && (
          <article className="grid gap-6 border-t border-[#D4C9B8] py-8 sm:grid-cols-[0.9fr_1.1fr] sm:items-center">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[#EDE4D3]">
              <ItemImage
                itemId={summary.standoutItem.id}
                collectionId={summary.standoutItem.collectionId}
                photoUrl={summary.standoutItem.photoUrl}
                enhancedPath={summary.standoutItem.photoEnhancedPath}
                type="enhanced"
                alt={summary.standoutItem.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8B5A2B]">
                A standout piece
              </p>
              <h3 className="mt-3 font-serif text-3xl">{summary.standoutItem.title}</h3>
              {standoutCollection && (
                <p className="mt-2 text-sm text-[#6F6257]">From {standoutCollection.name}</p>
              )}
              {summary.standoutItem.notes?.trim() && (
                <p className="mt-5 line-clamp-4 border-l-2 border-[#8B5A2B]/40 pl-4 font-serif italic leading-relaxed text-[#6F6257]">
                  “{summary.standoutItem.notes.trim()}”
                </p>
              )}
            </div>
          </article>
        )}

        {summary.collectionBreakdown.length > 0 && (
          <div className="border-t border-[#D4C9B8] pt-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8B5A2B]">
              Where the year grew
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {summary.collectionBreakdown.slice(0, 6).map((collection) => (
                <div
                  key={collection.collectionId}
                  className="flex items-center justify-between rounded-xl bg-white/45 px-4 py-3"
                >
                  <span className="font-serif">{collection.name}</span>
                  <span className="font-mono text-xs text-[#6F6257]">{collection.itemCount}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
