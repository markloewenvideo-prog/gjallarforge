
import { WEAPONS } from '../constants';
import { Participant, WeaponTier, CampaignConfig } from '../types';

export function rollDice(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function calculateAvgWeaponDamage(tier: WeaponTier): number {
  const w = WEAPONS[tier];
  return w.numDice * (w.sides + 1) / 2;
}

export function calculateExpectedWeeklyDamage(
  participants: Participant[],
  workoutsPerWeek: number
): number {
  return participants.reduce((total, p) => {
    const avgDmg = calculateAvgWeaponDamage(p.weaponTier);
    // Expected hit chance: (21 + Level - AC) / 20. 
    // Assuming a mid-range AC of 12 for balance calculations.
    const ac = 10 + (p.level / 2); // Dynamic AC estimation for balance
    const p_hit = Math.min(Math.max((21 + p.level - ac) / 20, 0.05), 0.95);
    // Crit multiplier is 1.05 (5% chance of doubling)
    return total + (p_hit * avgDmg * 1.05 * workoutsPerWeek);
  }, 0);
}

export function getWeaponDropTier(weekIndex: number, totalWeeks: number): WeaponTier {
  if (weekIndex >= totalWeeks - 1) return 4; // Legendary
  const progress = weekIndex / totalWeeks;
  if (progress < 0.25) return 1;
  if (progress < 0.55) return 2;
  return 3;
}

export function calculateHit(roll: number, level: number, ac: number): boolean {
  if (roll === 20) return true;
  if (roll === 1) return false;
  return (roll + level) >= ac;
}

export function calculateDamage(roll: number, weaponTier: WeaponTier): number {
  const w = WEAPONS[weaponTier];
  let damage = 0;
  for (let i = 0; i < w.numDice; i++) {
    damage += rollDice(w.sides);
  }
  if (roll === 20) {
    damage *= 2; // Critical hit: double damage dice
  }
  return damage;
}
