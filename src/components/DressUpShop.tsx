import React, { useState } from 'react';
import { X } from 'lucide-react';
import { CLOSET_ITEMS, ClosetItem, ClosetSlot, ClosetState } from '../game/closet';

interface DressUpShopProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: number;
  closet: ClosetState;
  /** Item being tried on (not owned yet), or null. */
  tryingOn: ClosetItem | null;
  onTryOn: (item: ClosetItem | null) => void;
  onBuy: (item: ClosetItem) => void;
  onEquip: (slot: ClosetSlot, id: string | null) => void;
}

const TABS: { slot: ClosetSlot; label: string; icon: string }[] = [
  { slot: 'hat', label: 'Hats', icon: '🎩' },
  { slot: 'glasses', label: 'Glasses', icon: '🕶️' },
  { slot: 'color', label: 'Colors', icon: '🎨' },
];

export const DressUpShop: React.FC<DressUpShopProps> = ({
  isOpen,
  onClose,
  wallet,
  closet,
  tryingOn,
  onTryOn,
  onBuy,
  onEquip,
}) => {
  const [tab, setTab] = useState<ClosetSlot>('hat');
  if (!isOpen) return null;

  const items = CLOSET_ITEMS.filter((i) => i.slot === tab && (!i.secret || closet.owned.includes(i.id)));
  const wearing = closet.outfit[tab];

  return (
    <div className="absolute inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none select-none">
      <div className="pointer-events-auto w-full max-w-xl max-h-[58vh] flex flex-col bg-gradient-to-b from-violet-50 to-pink-100 border-t-4 border-x-4 border-pink-300 rounded-t-[2rem] shadow-2xl text-slate-800">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="text-xl font-black text-pink-700">👒 Dress up Whiskers</h2>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white border-2 border-amber-300 text-lg font-black tabular-nums">
              ⭐ {wallet}
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-pink-200 text-pink-800 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 px-4 pb-2">
          {TABS.map((t) => (
            <button
              key={t.slot}
              onClick={() => {
                setTab(t.slot);
                onTryOn(null);
              }}
              className={`flex-1 py-2 rounded-2xl border-2 font-black text-base transition cursor-pointer ${
                tab === t.slot ? 'bg-pink-500 border-pink-600 text-white' : 'bg-white border-pink-200 text-pink-700'
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
            <button
              onClick={() => {
                onTryOn(null);
                onEquip(tab, null);
              }}
              className={`rounded-2xl p-2 border-4 flex flex-col items-center cursor-pointer transition active:scale-95 ${
                wearing === null && !tryingOn ? 'bg-emerald-100 border-emerald-400' : 'bg-white border-white'
              }`}
            >
              <span className="text-3xl leading-none">🚫</span>
              <span className="text-xs font-bold mt-1">None</span>
            </button>
            {items.map((item) => {
              const owned = closet.owned.includes(item.id);
              const isWearing = wearing === item.id && !tryingOn;
              const isTrying = tryingOn?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (owned) {
                      onTryOn(null);
                      onEquip(tab, item.id);
                    } else {
                      onTryOn(isTrying ? null : item);
                    }
                  }}
                  className={`relative rounded-2xl p-2 border-4 flex flex-col items-center cursor-pointer transition active:scale-95 ${
                    isWearing
                      ? 'bg-emerald-100 border-emerald-400'
                      : isTrying
                        ? 'bg-amber-100 border-amber-400'
                        : 'bg-white border-white'
                  }`}
                >
                  <span className="text-3xl leading-none">{item.icon}</span>
                  <span className="text-xs font-bold mt-1 leading-tight text-center">{item.name}</span>
                  <span
                    className={`mt-1 text-xs font-black tabular-nums ${
                      owned ? 'text-emerald-600' : wallet >= item.price ? 'text-amber-600' : 'text-slate-400'
                    }`}
                  >
                    {isWearing ? '✓ Wearing' : owned ? 'Wear' : `⭐ ${item.price}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {tryingOn && (
          <div className="px-4 pb-4 pt-1">
            {wallet >= tryingOn.price ? (
              <button
                onClick={() => onBuy(tryingOn)}
                className="w-full py-3 rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 border-4 border-white text-white text-xl font-black shadow-lg transition active:scale-95 cursor-pointer"
              >
                Buy {tryingOn.icon} {tryingOn.name} for ⭐ {tryingOn.price}
              </button>
            ) : (
              <div className="w-full py-3 rounded-2xl bg-white/70 border-2 border-dashed border-pink-300 text-center text-base font-bold text-pink-700">
                Collect {tryingOn.price - wallet} more ⭐ to get this!
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
