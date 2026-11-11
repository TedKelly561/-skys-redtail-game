/**
 * Everything beyond stars and treasures that should follow the player between devices when a
 * grown-up signs in: friends met, outfits, the fish house, the Grand Lake shortcut and the baby
 * fish buddy. Merging is generous: nothing a child earned on either device is ever lost.
 */
import { CLOSET_ITEMS, ClosetState, loadCloset, saveCloset } from './closet';
import { HOUSE_ITEMS, HouseState, loadHouse, saveHouse } from './house';
import { BUDDY_COLORS, BuddyLook, cleanBuddyName, loadBuddy, saveBuddy } from './buddy';
import { FRIENDS, FriendKind, loadMetFriends, saveMetFriends } from './friends';

export interface CloudExtras {
  friends: string[];
  closetOwned: string[];
  closetSpent: number;
  outfitHat: string;
  outfitGlasses: string;
  outfitColor: string;
  houseOwned: string[];
  houseSpent: number;
  lakeUnlocked: boolean;
  buddyName: string;
  buddyColor: string;
}

const LAKE_KEY = 'whiskers_lake_unlocked';

function lakeUnlockedLocally() {
  try {
    return localStorage.getItem(LAKE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function collectLocalExtras(): CloudExtras {
  const closet = loadCloset();
  const house = loadHouse();
  const buddy = loadBuddy();
  return {
    friends: [...loadMetFriends()],
    closetOwned: closet.owned,
    closetSpent: closet.spent,
    outfitHat: closet.outfit.hat || '',
    outfitGlasses: closet.outfit.glasses || '',
    outfitColor: closet.outfit.color || '',
    houseOwned: house.owned,
    houseSpent: house.spent,
    lakeUnlocked: lakeUnlockedLocally(),
    buddyName: buddy?.name || '',
    buddyColor: buddy?.color || '',
  };
}

const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

/** Cleans up whatever came back from the cloud (it could be from an older or newer game). */
export function sanitizeExtras(raw: Partial<Record<keyof CloudExtras, unknown>>): CloudExtras {
  const list = (v: unknown, valid: Set<string>) =>
    (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && valid.has(x));
  const num = (v: unknown) => Math.max(0, Math.min(1000000, Math.floor(Number(v) || 0)));
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  const closetIds = new Set(CLOSET_ITEMS.map((i) => i.id));
  return {
    friends: list(raw.friends, new Set(FRIENDS.map((f) => f.kind))),
    closetOwned: list(raw.closetOwned, closetIds),
    closetSpent: num(raw.closetSpent),
    outfitHat: str(raw.outfitHat, 40),
    outfitGlasses: str(raw.outfitGlasses, 40),
    outfitColor: str(raw.outfitColor, 40),
    houseOwned: list(raw.houseOwned, new Set(HOUSE_ITEMS.map((i) => i.id))),
    houseSpent: num(raw.houseSpent),
    lakeUnlocked: raw.lakeUnlocked === true,
    buddyName: cleanBuddyName(str(raw.buddyName, 40)),
    buddyColor: BUDDY_COLORS.some((c) => c.color === raw.buddyColor) ? (raw.buddyColor as string) : '',
  };
}

/**
 * Combine this device with the cloud. Owned things and friends are joined; stars spent are at
 * least the price of everything owned (so the star wallet stays honest); outfit and buddy
 * prefer this device and fall back to the cloud.
 */
export function mergeExtras(local: CloudExtras, cloud: CloudExtras): CloudExtras {
  const closetOwned = union(local.closetOwned, cloud.closetOwned);
  const houseOwned = union(local.houseOwned, cloud.houseOwned);
  const closetPrice = closetOwned.reduce((s, id) => s + (CLOSET_ITEMS.find((i) => i.id === id)?.price || 0), 0);
  const housePrice = houseOwned.reduce((s, id) => s + (HOUSE_ITEMS.find((i) => i.id === id)?.price || 0), 0);
  const owns = (id: string) => !id || closetOwned.includes(id);
  const pickOutfit = (a: string, b: string) => (a && owns(a) ? a : b && owns(b) ? b : '');
  const hasLocalBuddy = !!local.buddyName;
  return {
    friends: union(local.friends, cloud.friends),
    closetOwned,
    closetSpent: Math.max(local.closetSpent, cloud.closetSpent, closetPrice),
    outfitHat: pickOutfit(local.outfitHat, cloud.outfitHat),
    outfitGlasses: pickOutfit(local.outfitGlasses, cloud.outfitGlasses),
    outfitColor: pickOutfit(local.outfitColor, cloud.outfitColor),
    houseOwned,
    houseSpent: Math.max(local.houseSpent, cloud.houseSpent, housePrice),
    lakeUnlocked: local.lakeUnlocked || cloud.lakeUnlocked,
    buddyName: hasLocalBuddy ? local.buddyName : cloud.buddyName,
    buddyColor: hasLocalBuddy ? local.buddyColor : cloud.buddyColor,
  };
}

export function sameExtras(a: CloudExtras, b: CloudExtras) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Save merged extras on this device; returns the pieces the app needs to refresh. */
export function applyExtrasLocally(e: CloudExtras): {
  friends: FriendKind[];
  closet: ClosetState;
  house: HouseState;
  buddy: BuddyLook | null;
  lakeUnlocked: boolean;
} {
  const friends = e.friends as FriendKind[];
  saveMetFriends(new Set(friends));
  const closet: ClosetState = {
    owned: e.closetOwned,
    spent: e.closetSpent,
    outfit: { hat: e.outfitHat || null, glasses: e.outfitGlasses || null, color: e.outfitColor || null },
  };
  saveCloset(closet);
  const house: HouseState = { owned: e.houseOwned, spent: e.houseSpent };
  saveHouse(house);
  const buddy = e.buddyName && e.buddyColor ? { name: e.buddyName, color: e.buddyColor } : loadBuddy();
  if (buddy) saveBuddy(buddy);
  if (e.lakeUnlocked) {
    try {
      localStorage.setItem(LAKE_KEY, 'true');
    } catch {
      // ignore
    }
  }
  return { friends, closet: loadCloset(), house: loadHouse(), buddy, lakeUnlocked: e.lakeUnlocked };
}
