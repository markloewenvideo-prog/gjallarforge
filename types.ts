


export type WeaponTier = number;

export interface Weapon {
  tier: WeaponTier;
  name: string;
  bonus: number;
}

export interface Participant {
  id: string;
  name: string;
  level: number;
  weaponTier: WeaponTier;
  totalWorkouts: number;
  workoutsThisWeek: number;
  isLootDisqualified: boolean; // From rolling a natural 1 against current enemy
  isInspired: boolean; // From rolling a natural 20
  isBlessed: boolean; // Replaces Inspired in the Shadow Realm
  bountyScore: number;
  nat20Count: number;
  highestSingleRoll: number;
  bountyScoreUpdatedAt: string;
}

export interface Enemy {
  id: string;
  name: string;
  description: string;
  hp: number;
  maxHp: number;
  ac: number;
  weaponDropTier: WeaponTier;
  isDead: boolean;
  lootWinnerId?: string;
}

export interface LogEntry {
  id: string;
  type: 'attack' | 'defeat' | 'loot' | 'system';
  participantId?: string;
  enemyId?: string;
  roll?: number;
  damage?: number;
  isCrit?: boolean;
  isFumble?: boolean;
  message?: string;
  timestamp: number;
}

export interface CampaignConfig {
  numParticipants: number;
  workoutsPerWeek: number;
  totalWeeks: number;
}

export interface AppState {
  config: CampaignConfig | null;
  participants: Participant[];
  enemies: Enemy[];
  currentEnemyIndex: number;
  currentWeek: number;
  logs: LogEntry[];
}
