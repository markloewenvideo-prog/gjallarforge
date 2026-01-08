
import { Weapon, WeaponTier } from './types';

export const WEAPONS: Record<WeaponTier, Weapon> = {
  0: { tier: 0, name: "Rusty Dagger", dice: "1d4", numDice: 1, sides: 4 },
  1: { tier: 1, name: "Broadsword", dice: "2d4", numDice: 2, sides: 4 },
  2: { tier: 2, name: "War Hammer", dice: "3d8", numDice: 3, sides: 8 },
  3: { tier: 3, name: "Great Axe", dice: "4d12", numDice: 4, sides: 12 },
  4: { tier: 4, name: "Legendary Dragonbane", dice: "10d10", numDice: 10, sides: 10 },
};

export const DICE_COLORS = {
  20: 'text-[#8b0000] font-bold drop-shadow-sm scale-110 inline-block',
  1: 'text-gray-400 font-bold line-through inline-block',
  normal: 'text-[#3a352f] font-bold'
};

export const LEVEL_TITLES: Record<number, string> = {
  1: "Initiate",
  2: "Sweat Apprentice",
  3: "Iron Enthusiast",
  4: "Certified Lifter of Things",
  5: "Muscle Adept",
  6: "Anvil Botherer",
  7: "Forge Regular",
  8: "Respectably Swole",
  9: "Hammer-Sworn",
  10: "Paragon of Gains"
};

export const FLAVOR_TEXT = {
  success: [
    "Horn sounds. “Aye. That counts.”",
    "Krag nods. The forge approves.",
    "A proud horn blast echoes.",
    "“Good iron in you,” says Krag.",
    "The horn sings. Gains logged.",
    "Krag grunts. That’s praise.",
    "Anvil rings. Success."
  ],
  failure: [
    "No horn. Krag squints.",
    "“That rep lied,” says Krag.",
    "A disappointed grunt.",
    "Krag shakes his head.",
    "The forge remains silent.",
    "“Again,” mutters Krag."
  ],
  fumble: [
    "False horn. Immediate stop.",
    "“…No,” says Krag.",
    "Even the anvil judges you.",
    "“We pretend that didn’t happen.”"
  ],
  crit: "Aye. That counts for double!"
};

export function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level] || LEVEL_TITLES[10];
}
