export type DailyMissionMetric =
  | 'eat_larva'
  | 'eat_minnow'
  | 'eat_any_food'
  | 'collect_star'
  | 'collect_any_treasure'
  | 'collect_smooth_stone'
  | 'collect_scale_or_pearl'
  | 'use_sonar'
  | 'swim_meters';

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  icon: string;
  metric: DailyMissionMetric;
  target: number;
  current: number;
  rewardPoints: number;
  completed: boolean;
}

export interface DailyMissionsState {
  dateKey: string;
  bonusSetIndex: number;
  missions: DailyMission[];
  allCompletedBonusClaimed: boolean;
  allCompletedBonusPoints: number;
  streakDays: number;
  lastStreakDateKey: string | null;
  totalMissionsCompleted: number;
}

const STORAGE_KEY = 'whiskers_daily_missions_v1';

export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface MissionTemplate {
  idSuffix: string;
  title: string;
  description: string;
  icon: string;
  metric: DailyMissionMetric;
  target: number;
  rewardPoints: number;
}

const FORAGING_TEMPLATES: MissionTemplate[] = [
  {
    idSuffix: 'eat_10_larvae',
    title: 'Eat 10 Larvae',
    description: 'Munch on 10 Wiggly Red Larvae along the riverbed to keep Whiskers energized.',
    icon: '🐛',
    metric: 'eat_larva',
    target: 10,
    rewardPoints: 50,
  },
  {
    idSuffix: 'eat_6_minnows',
    title: 'Catch 6 Silver Minnows',
    description: 'Snack on 6 darting Silver Feeder Minnows in the river channel.',
    icon: '🐟',
    metric: 'eat_minnow',
    target: 6,
    rewardPoints: 60,
  },
  {
    idSuffix: 'eat_12_snacks',
    title: 'Eat 12 River Snacks',
    description: 'Eat any 12 larvae, silver minnows, or camu-camu berries.',
    icon: '🍒',
    metric: 'eat_any_food',
    target: 12,
    rewardPoints: 65,
  },
];

const STAR_TEMPLATES: MissionTemplate[] = [
  {
    idSuffix: 'collect_3_stars',
    title: 'Collect 3 Shiny Stars',
    description: 'Swim through 3 glowing Golden River Stars in the current.',
    icon: '⭐',
    metric: 'collect_star',
    target: 3,
    rewardPoints: 50,
  },
  {
    idSuffix: 'collect_5_stars',
    title: 'Collect 5 Shiny Stars',
    description: 'Gather 5 Golden River Stars on your way toward the Grand Lake.',
    icon: '🌟',
    metric: 'collect_star',
    target: 5,
    rewardPoints: 75,
  },
  {
    idSuffix: 'collect_4_stars',
    title: 'Collect 4 Shiny Stars',
    description: 'Follow the sparkling bends to collect 4 Golden River Stars.',
    icon: '⭐',
    metric: 'collect_star',
    target: 4,
    rewardPoints: 60,
  },
];

const TREASURE_AND_EXPLORE_TEMPLATES: MissionTemplate[] = [
  {
    idSuffix: 'find_3_treasures',
    title: 'Find 3 Shiny Treasures',
    description: 'Collect any 3 river treasures (stones, scales, trinkets, or pearls).',
    icon: '💎',
    metric: 'collect_any_treasure',
    target: 3,
    rewardPoints: 65,
  },
  {
    idSuffix: 'find_2_jade_stones',
    title: 'Collect 2 Smooth Stones',
    description: 'Scoop up 2 polished Jade River Stones resting on the riverbed.',
    icon: '🪨',
    metric: 'collect_smooth_stone',
    target: 2,
    rewardPoints: 60,
  },
  {
    idSuffix: 'use_sonar_3',
    title: 'Use Barbel Sniffer 3 Times',
    description: "Pulse Whiskers' sensory whiskers (Press E or Sniff button) 3 times.",
    icon: '📡',
    metric: 'use_sonar',
    target: 3,
    rewardPoints: 45,
  },
  {
    idSuffix: 'swim_250m',
    title: 'Swim 250 Meters Downstream',
    description: 'Explore 250 meters of riffles, runs, and deep scour pools.',
    icon: '🌊',
    metric: 'swim_meters',
    target: 250,
    rewardPoints: 55,
  },
  {
    idSuffix: 'find_2_scales_pearls',
    title: 'Find 2 Scales or Pearls',
    description: 'Collect 2 Shimmering Arapaima Scales or Glowing River Pearls.',
    icon: '🦪',
    metric: 'collect_scale_or_pearl',
    target: 2,
    rewardPoints: 70,
  },
];

function generateMissionsForSeed(dateKey: string, bonusSetIndex: number): DailyMission[] {
  // On a player's first set of the day (bonusSetIndex === 0), if it's their very first time or standard rotation,
  // we use a deterministic index from dateKey, ensuring 'Eat 10 Larvae' and 'Collect 3 Shiny Stars' appear first!
  const fIdx = bonusSetIndex % FORAGING_TEMPLATES.length;
  const sIdx = bonusSetIndex % STAR_TEMPLATES.length;
  const tIdx = bonusSetIndex % TREASURE_AND_EXPLORE_TEMPLATES.length;

  const picked = [
    FORAGING_TEMPLATES[fIdx],
    STAR_TEMPLATES[sIdx],
    TREASURE_AND_EXPLORE_TEMPLATES[tIdx],
  ];

  return picked.map((tpl) => ({
    id: `${dateKey}_set${bonusSetIndex}_${tpl.idSuffix}`,
    title: tpl.title,
    description: tpl.description,
    icon: tpl.icon,
    metric: tpl.metric,
    target: tpl.target,
    current: 0,
    rewardPoints: tpl.rewardPoints,
    completed: false,
  }));
}

export class DailyMissionsManager {
  private state: DailyMissionsState;
  private swimAccumulator: number = 0;

  constructor() {
    this.state = this.loadOrInitState();
  }

  private loadOrInitState(): DailyMissionsState {
    const today = getTodayDateKey();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DailyMissionsState;
        if (parsed && parsed.dateKey === today && Array.isArray(parsed.missions)) {
          return parsed;
        }
        // New day! Preserve streak if completed yesterday or today
        const yesterday = getYesterdayDateKey();
        const keepStreak =
          parsed.lastStreakDateKey === yesterday || parsed.lastStreakDateKey === today;
        const freshState: DailyMissionsState = {
          dateKey: today,
          bonusSetIndex: 0,
          missions: generateMissionsForSeed(today, 0),
          allCompletedBonusClaimed: false,
          allCompletedBonusPoints: 100,
          streakDays: keepStreak ? parsed.streakDays || 0 : 0,
          lastStreakDateKey: parsed.lastStreakDateKey || null,
          totalMissionsCompleted: parsed.totalMissionsCompleted || 0,
        };
        this.saveState(freshState);
        return freshState;
      }
    } catch {
      // ignore localStorage read error
    }

    const initial: DailyMissionsState = {
      dateKey: today,
      bonusSetIndex: 0,
      missions: generateMissionsForSeed(today, 0),
      allCompletedBonusClaimed: false,
      allCompletedBonusPoints: 100,
      streakDays: 0,
      lastStreakDateKey: null,
      totalMissionsCompleted: 0,
    };
    this.saveState(initial);
    return initial;
  }

  private saveState(stateToSave: DailyMissionsState = this.state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // ignore
    }
  }

  public getState(): DailyMissionsState {
    // Check if date rolled over while app was open
    const today = getTodayDateKey();
    if (this.state.dateKey !== today) {
      this.state = this.loadOrInitState();
    }
    return {
      ...this.state,
      missions: this.state.missions.map((m) => ({ ...m })),
    };
  }

  /**
   * Allows a player who finished all 3 daily missions to unlock a fresh bonus set of 3 tasks
   */
  public startNextBonusSet(): DailyMissionsState {
    const nextIndex = this.state.bonusSetIndex + 1;
    this.state = {
      ...this.state,
      bonusSetIndex: nextIndex,
      missions: generateMissionsForSeed(this.state.dateKey, nextIndex),
      allCompletedBonusClaimed: false,
    };
    this.saveState();
    return this.getState();
  }

  /**
   * Records progress for matching metrics and returns any newly completed missions + bonus points earned
   */
  public recordEvent(
    metrics: DailyMissionMetric[],
    amount: number = 1
  ): {
    completedMissions: DailyMission[];
    allClearBonusAwarded: boolean;
    totalBonusPointsEarned: number;
    updatedState: DailyMissionsState;
  } {
    const today = getTodayDateKey();
    if (this.state.dateKey !== today) {
      this.state = this.loadOrInitState();
    }

    const completedMissions: DailyMission[] = [];
    let totalBonusPointsEarned = 0;
    let anyChanged = false;

    for (const mission of this.state.missions) {
      if (mission.completed) continue;
      if (metrics.includes(mission.metric)) {
        mission.current = Math.min(mission.target, mission.current + amount);
        anyChanged = true;

        if (mission.current >= mission.target) {
          mission.completed = true;
          completedMissions.push({ ...mission });
          totalBonusPointsEarned += mission.rewardPoints;
          this.state.totalMissionsCompleted += 1;

          // Update daily habit streak on first completed mission of the day
          if (this.state.lastStreakDateKey !== today) {
            const yesterday = getYesterdayDateKey();
            if (this.state.lastStreakDateKey === yesterday) {
              this.state.streakDays += 1;
            } else {
              this.state.streakDays = 1;
            }
            this.state.lastStreakDateKey = today;
          }
        }
      }
    }

    let allClearBonusAwarded = false;
    const allDone = this.state.missions.every((m) => m.completed);
    if (allDone && !this.state.allCompletedBonusClaimed) {
      this.state.allCompletedBonusClaimed = true;
      allClearBonusAwarded = true;
      totalBonusPointsEarned += this.state.allCompletedBonusPoints;
      anyChanged = true;
    }

    if (anyChanged) {
      this.saveState();
    }

    return {
      completedMissions,
      allClearBonusAwarded,
      totalBonusPointsEarned,
      updatedState: this.getState(),
    };
  }

  /**
   * Accumulates continuous swimming distance in meters and triggers 'swim_meters' mission updates every 5m
   */
  public recordSwimDistanceDelta(metersDelta: number) {
    if (metersDelta <= 0) return null;
    this.swimAccumulator += metersDelta;
    if (this.swimAccumulator >= 5) {
      const wholeMeters = Math.floor(this.swimAccumulator);
      this.swimAccumulator -= wholeMeters;
      return this.recordEvent(['swim_meters'], wholeMeters);
    }
    return null;
  }
}
