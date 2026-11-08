import React from 'react';
import { X } from 'lucide-react';
import { FRIENDS, FriendKind } from '../game/friends';

interface StickerBookProps {
  isOpen: boolean;
  onClose: () => void;
  metFriends: FriendKind[];
  stickers: Partial<Record<FriendKind, string>>;
  playerName: string;
}

export const StickerBook: React.FC<StickerBookProps> = ({
  isOpen,
  onClose,
  metFriends,
  stickers,
  playerName,
}) => {
  if (!isOpen) return null;
  const met = new Set(metFriends);

  return (
    <div
      className="absolute inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4 select-none pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-gradient-to-b from-amber-50 to-orange-100 border-4 border-amber-300 rounded-[2rem] p-4 sm:p-5 shadow-2xl text-slate-800 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl sm:text-2xl font-black text-amber-900">
            📖 {playerName ? `${playerName}'s` : 'My'} River Friends
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-amber-200 text-amber-900 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="text-center text-base font-bold text-amber-800 mb-3">
          {met.size} of {FRIENDS.length} friends found
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FRIENDS.map((f) => {
            const isMet = met.has(f.kind);
            const img = stickers[f.kind];
            return (
              <div
                key={f.kind}
                className={`rounded-3xl p-2 flex flex-col items-center text-center border-4 ${
                  isMet
                    ? 'bg-white border-white shadow-lg -rotate-1'
                    : 'bg-amber-200/50 border-dashed border-amber-400/70'
                }`}
              >
                <div className="w-full aspect-square flex items-center justify-center">
                  {img ? (
                    <img
                      src={img}
                      alt={isMet ? f.name : 'A friend you have not met yet'}
                      className={`w-full h-full object-contain ${
                        isMet ? 'drop-shadow-md' : 'brightness-0 opacity-25'
                      }`}
                      draggable={false}
                    />
                  ) : (
                    <span className="text-5xl">{isMet ? '⭐' : '❓'}</span>
                  )}
                </div>
                <div className={`text-sm font-black ${isMet ? 'text-amber-900' : 'text-amber-700/70'}`}>
                  {isMet ? f.name : '???'}
                </div>
                {!isMet && <div className="text-[11px] font-semibold text-amber-800/70 leading-tight">{f.hint}</div>}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-sm font-bold text-amber-900/80">
          👃 Press Sniff near an animal to say hi!
        </p>
      </div>
    </div>
  );
};
