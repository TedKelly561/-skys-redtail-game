import React, { useState } from 'react';
import { X } from 'lucide-react';
import { HOUSE_ITEMS, HouseItem, HouseState, HouseView } from '../game/house';

interface FishHouseRoomProps {
  wallet: number;
  house: HouseState;
  view: HouseView;
  sleeping: boolean;
  isNight: boolean;
  onView: (view: HouseView) => void;
  onBuy: (item: HouseItem) => void;
  onBedtime: () => void;
  onExit: () => void;
}

const btn =
  'pointer-events-auto flex flex-col items-center justify-center gap-0.5 w-[4.2rem] h-[4.2rem] sm:w-20 sm:h-20 rounded-2xl border-2 shadow-lg font-bold text-[11px] sm:text-xs transition active:scale-95 cursor-pointer';

export const FishHouseRoom: React.FC<FishHouseRoomProps> = ({
  wallet,
  house,
  view,
  sleeping,
  isNight,
  onView,
  onBuy,
  onBedtime,
  onExit,
}) => {
  const [decorating, setDecorating] = useState(false);

  const tab = (label: string, icon: string, active: boolean, onClick: () => void, aria?: string) => (
    <button
      onClick={onClick}
      aria-label={aria || label}
      className={`${btn} ${
        active ? 'bg-amber-300 border-white text-slate-900' : 'bg-slate-900/75 border-white/30 text-white hover:bg-slate-800/80'
      }`}
    >
      <span className="text-2xl sm:text-3xl leading-none">{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="absolute inset-0 z-30 pointer-events-none select-none">
      {/* Top bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
        <div className="px-3 py-1.5 rounded-full bg-slate-900/75 text-white font-black text-sm sm:text-base shadow">
          🏠 Whiskers&apos; House
        </div>
        <div className="px-3 py-1.5 rounded-full bg-slate-900/75 text-amber-200 font-black text-sm sm:text-base shadow tabular-nums">
          ⭐ {wallet}
        </div>
      </div>

      {/* Decorate panel */}
      {decorating && !sleeping && (
        <div className="absolute left-2 right-2 bottom-[6.2rem] sm:bottom-28 mx-auto max-w-xl pointer-events-auto rounded-3xl bg-slate-900/92 border border-slate-700 shadow-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white font-black">Decorate with stars</div>
            <button
              onClick={() => setDecorating(false)}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 cursor-pointer"
              aria-label="Close decorating"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2 max-h-[38vh] overflow-y-auto">
            {HOUSE_ITEMS.map((item) => {
              const owned = house.owned.includes(item.id);
              const canBuy = !owned && wallet >= item.price;
              return (
                <button
                  key={item.id}
                  onClick={() => canBuy && onBuy(item)}
                  disabled={!canBuy}
                  aria-label={owned ? `${item.name}, in your house` : `${item.name}, ${item.price} stars`}
                  className={`flex flex-col items-center gap-0.5 p-2 rounded-2xl border-2 text-center transition ${
                    owned
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                      : canBuy
                        ? 'bg-slate-800 border-amber-300 text-white hover:bg-slate-700 active:scale-95 cursor-pointer'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400'
                  }`}
                >
                  <span className="text-3xl leading-none">{item.icon}</span>
                  <span className="text-[10px] sm:text-xs font-bold leading-tight">{item.name}</span>
                  <span className="text-[11px] font-black tabular-nums">
                    {owned ? '✓ Yours' : canBuy ? `⭐ ${item.price}` : `⭐ ${item.price}`}
                  </span>
                </button>
              );
            })}
          </div>
          {wallet < Math.min(...HOUSE_ITEMS.filter((i) => !house.owned.includes(i.id)).map((i) => i.price), Infinity) && (
            <p className="text-[11px] text-slate-300 mt-2 text-center">
              Get more stars: bubble jumps, pearls, tag with the otter, and the waterfall!
            </p>
          )}
        </div>
      )}

      {/* Bottom buttons */}
      {!sleeping && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 sm:gap-3 px-2">
          {tab('Decorate', '🛋️', decorating, () => {
            setDecorating(!decorating);
            onView('room');
          })}
          {tab('Trophies', '🏆', view === 'trophies' && !decorating, () => {
            setDecorating(false);
            onView(view === 'trophies' ? 'room' : 'trophies');
          })}
          {tab('Friends', '🖼️', view === 'friends' && !decorating, () => {
            setDecorating(false);
            onView(view === 'friends' ? 'room' : 'friends');
          })}
          {tab(isNight ? 'Wake up' : 'Bedtime', isNight ? '🌞' : '🛏️', false, () => {
            setDecorating(false);
            onBedtime();
          })}
          {tab('Swim out', '🚪', false, onExit)}
        </div>
      )}

      {/* Bedtime */}
      {sleeping && (
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/85 via-indigo-900/70 to-indigo-950/85 flex flex-col items-center justify-center animate-pop">
          <div className="text-6xl mb-2">😴</div>
          <div className="text-4xl font-black text-white animate-wiggle">Zzz…</div>
        </div>
      )}
    </div>
  );
};
