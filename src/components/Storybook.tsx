import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { FriendKind, friendName } from '../game/friends';
import { Photo } from '../game/photos';
import { StoryPage, Trip, storyPages } from '../game/storybook';
import { narrator } from '../game/voice';

interface StorybookProps {
  trip: Trip;
  playerName: string;
  stickers: Partial<Record<FriendKind, string>>;
  photos: Photo[];
  /** Reached the Grand Lake: the story ends with "The End". */
  finished: boolean;
  onClose: () => void;
}

/** A read-aloud picture book of Whiskers' trip, one page at a time. */
export const Storybook: React.FC<StorybookProps> = ({ trip, playerName, stickers, photos, finished, onClose }) => {
  // Photos taken during this trip (newest first in the album).
  const tripPhotos = useMemo(() => photos.filter((p) => p.at >= trip.startedAt).slice(0, 4), [photos, trip.startedAt]);
  const pages: StoryPage[] = useMemo(
    () => storyPages(trip, playerName, tripPhotos.length, finished),
    [trip, playerName, tripPhotos.length, finished]
  );
  const [index, setIndex] = useState(0);
  const page = pages[Math.min(index, pages.length - 1)];
  const last = index >= pages.length - 1;

  // Read each page aloud as it turns.
  useEffect(() => {
    narrator.say(`${page.title}. ${page.text}`, true);
  }, [page]);

  const turn = (step: number) => setIndex((i) => Math.max(0, Math.min(pages.length - 1, i + step)));

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-3 sm:p-6 select-none">
      <div className="animate-pop relative w-full max-w-lg rounded-[2rem] border-4 border-amber-200 bg-gradient-to-b from-amber-50 to-orange-100 text-slate-800 shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          aria-label="Close the storybook"
          className="absolute top-3 right-3 z-10 w-11 h-11 rounded-full bg-white/80 border-2 border-amber-300 flex items-center justify-center text-slate-700 cursor-pointer active:scale-95"
        >
          <X className="w-6 h-6" />
        </button>

        <div key={index} className="animate-pop px-6 pt-8 pb-4 min-h-[22rem] flex flex-col items-center text-center">
          <div className={page.big ? 'text-7xl mb-3' : 'text-6xl mb-2'} aria-hidden="true">
            {page.emoji}
          </div>
          <h2 className={`font-black text-amber-900 leading-tight ${page.big ? 'text-3xl' : 'text-2xl'}`}>{page.title}</h2>
          <p className="mt-3 text-lg sm:text-xl font-semibold leading-snug text-slate-700">{page.text}</p>

          {page.friends && (
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {page.friends.map((f) => (
                <figure key={f} className="w-20 flex flex-col items-center">
                  {stickers[f] ? (
                    <img src={stickers[f]} alt="" className="w-20 h-20 rounded-2xl bg-white border-2 border-amber-200 object-contain" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-white border-2 border-amber-200 flex items-center justify-center text-4xl">
                      🐾
                    </div>
                  )}
                  <figcaption className="mt-1 text-xs font-bold text-amber-900">{friendName(f)}</figcaption>
                </figure>
              ))}
            </div>
          )}

          {page.photos && (
            <div className="mt-4 grid grid-cols-2 gap-2 w-full">
              {tripPhotos.map((p) => (
                <img key={p.at} src={p.url} alt="" className="w-full rounded-xl border-2 border-white shadow rotate-[-1deg] odd:rotate-1" />
              ))}
            </div>
          )}

          {last && (
            <div className="mt-6 w-full flex flex-col gap-2">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-3xl bg-gradient-to-b from-emerald-400 to-emerald-600 border-4 border-white text-white text-xl font-black shadow-lg cursor-pointer active:scale-95"
              >
                {finished ? 'Close the book 💛' : 'Keep swimming'}
              </button>
              <button
                onClick={() => setIndex(0)}
                className="w-full py-2 rounded-2xl bg-white/70 border-2 border-amber-200 text-amber-900 text-base font-bold cursor-pointer active:scale-95"
              >
                Read it again
              </button>
            </div>
          )}
        </div>

        {/* Page turning */}
        <div className="flex items-center justify-between px-4 pb-4">
          <button
            onClick={() => turn(-1)}
            disabled={index === 0}
            aria-label="Previous page"
            className="w-14 h-14 rounded-full bg-amber-400 disabled:opacity-30 border-4 border-white text-white flex items-center justify-center shadow cursor-pointer active:scale-95"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <div className="flex gap-1.5" aria-hidden="true">
            {pages.map((_, i) => (
              <span key={i} className={`w-2.5 h-2.5 rounded-full ${i === index ? 'bg-amber-600' : 'bg-amber-300'}`} />
            ))}
          </div>
          <button
            onClick={() => turn(1)}
            disabled={last}
            aria-label="Next page"
            className="w-14 h-14 rounded-full bg-amber-400 disabled:opacity-30 border-4 border-white text-white flex items-center justify-center shadow cursor-pointer active:scale-95"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
};
