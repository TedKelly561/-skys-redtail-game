import { FriendKind, friendName } from './friends';

/**
 * Storybook: Whiskers' trip is written down as it happens (friends met, brave moments, races,
 * treasures), then shown as a little read-aloud picture book when the Grand Lake is reached, or
 * any time from the pause menu or title screen.
 */
const KEY = 'whiskers_trip_v1';

export type MomentKind =
  | 'croc'
  | 'piranhas'
  | 'cat'
  | 'oops'
  | 'dolphinWin'
  | 'dolphinRace'
  | 'ghostWin'
  | 'ghostRace'
  | 'pip'
  | 'learn'
  | 'chest'
  | 'cave'
  | 'crystal'
  | 'turtleRide';

export interface Trip {
  startedAt: number;
  /** Stars and treasures when the trip began, to count what was found on the way. */
  startStars: number;
  startTreasures: number;
  stars: number;
  treasures: number;
  distance: number;
  seconds: number;
  friends: FriendKind[];
  moments: Partial<Record<MomentKind, number>>;
  /** Who was raced in the ghost race, if anyone. */
  ghostRival: string;
  reachedLake: boolean;
}

export function newTrip(stars: number, treasures: number): Trip {
  return {
    startedAt: Date.now(),
    startStars: stars,
    startTreasures: treasures,
    stars,
    treasures,
    distance: 0,
    seconds: 0,
    friends: [],
    moments: {},
    ghostRival: '',
    reachedLake: false,
  };
}

export function loadTrip(): Trip | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!t || typeof t.startedAt !== 'number' || !Array.isArray(t.friends) || typeof t.moments !== 'object') return null;
    return t as Trip;
  } catch {
    return null;
  }
}

export function saveTrip(trip: Trip) {
  try {
    localStorage.setItem(KEY, JSON.stringify(trip));
  } catch {
    // ignore: the storybook is a bonus
  }
}

export interface StoryPage {
  emoji: string;
  title: string;
  /** Read aloud and shown under the title. */
  text: string;
  /** Friends to show as stickers. */
  friends?: FriendKind[];
  /** Show this trip's photos. */
  photos?: boolean;
  /** Cover / ending pages get the big book style. */
  big?: boolean;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function listJoin(items: string[]) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** The book's pages for a trip. Pages with nothing to tell are left out. */
export function storyPages(trip: Trip, playerName: string, photoCount: number, finished: boolean): StoryPage[] {
  const who = playerName ? `${playerName} and Whiskers` : 'Whiskers';
  const date = new Date(trip.startedAt).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const pages: StoryPage[] = [
    { emoji: '📖', title: `${who}' River Adventure`, text: `A story from ${date}.`, big: true },
  ];

  const meters = Math.round(trip.distance);
  pages.push({
    emoji: trip.reachedLake ? '🏝️' : '🌊',
    title: 'The big swim',
    text: trip.reachedLake
      ? `Whiskers swam ${meters} meters down the river, all the way home to the Grand Lake!`
      : `Whiskers swam ${meters} meters down the river.`,
  });

  const friends = trip.friends.filter((f) => f !== 'rainbow');
  if (friends.length > 0) {
    pages.push({
      emoji: '🤝',
      title: friends.length === 1 ? 'A new friend' : 'New friends',
      text: `Whiskers said hello to ${listJoin(friends.map(friendName))}.`,
      friends,
    });
  }

  const stars = Math.max(0, trip.stars - trip.startStars);
  const treasures = Math.max(0, trip.treasures - trip.startTreasures);
  if (stars > 0 || treasures > 0 || trip.friends.includes('rainbow')) {
    const bits: string[] = [];
    if (stars > 0) bits.push(plural(stars, 'star', 'stars'));
    if (treasures > 0) bits.push(plural(treasures, 'treasure', 'treasures'));
    pages.push({
      emoji: '⭐',
      title: 'Treasures',
      text:
        (bits.length ? `Whiskers found ${listJoin(bits)}.` : '') +
        (trip.friends.includes('rainbow') ? ' And the shiny Rainbow Pearl!' : ''),
    });
  }

  const m = trip.moments;
  const brave: string[] = [];
  if (m.croc) brave.push(m.croc === 1 ? 'got away from a grumpy croc' : `got away from ${m.croc} grumpy crocs`);
  if (m.piranhas) brave.push(m.piranhas === 1 ? 'zoomed away from the piranhas' : `zoomed away from piranhas ${m.piranhas} times`);
  if (m.cat) brave.push(m.cat === 1 ? 'made a sneaky cat fall in the river' : `made ${m.cat} sneaky cats fall in the river`);
  if (brave.length > 0) {
    pages.push({ emoji: '🦸', title: 'Brave moments', text: `Whiskers ${listJoin(brave)}. Splash!` });
  }

  const fun: string[] = [];
  if (m.ghostWin) fun.push(trip.ghostRival ? `beat ${trip.ghostRival}'s ghost in the race` : 'set a super fast race time');
  else if (m.ghostRace) fun.push(trip.ghostRival ? `raced ${trip.ghostRival}'s ghost` : 'raced to the checkered flags');
  if (m.dolphinWin) fun.push('won the race against the pink dolphin');
  else if (m.dolphinRace) fun.push('raced the pink dolphin');
  if (m.pip) fun.push(m.pip === 1 ? 'found little brother Pip' : `found Pip ${m.pip} times`);
  if (m.chest) fun.push(m.chest === 1 ? 'opened a treasure chest' : `opened ${m.chest} treasure chests`);
  if (m.learn) fun.push(m.learn === 1 ? 'answered a puzzle' : `answered ${m.learn} puzzles`);
  if (fun.length > 0) {
    pages.push({ emoji: '🎉', title: 'Fun and games', text: `Whiskers ${listJoin(fun)}.` });
  }

  if (m.cave) {
    const cave: string[] = ['swam into the glowing cave under the lake'];
    if (m.crystal) cave.push(m.crystal === 1 ? 'found a sparkly crystal' : `found ${m.crystal} sparkly crystals`);
    if (m.turtleRide) cave.push("rode on Grandpa Turtle's back");
    pages.push({ emoji: '💎', title: 'The glowing cave', text: `Whiskers ${listJoin(cave)}.` });
  }

  if (photoCount > 0) {
    pages.push({ emoji: '📷', title: 'Photos', text: photoCount === 1 ? 'Here is a photo from the trip.' : 'Here are photos from the trip.', photos: true });
  }

  pages.push(
    finished
      ? { emoji: '🌙', title: 'The End', text: 'Whiskers was home with the family. Sweet dreams, Whiskers!', big: true }
      : { emoji: '🐟', title: 'To be continued…', text: 'The adventure is still going. Keep swimming!', big: true }
  );
  return pages;
}
