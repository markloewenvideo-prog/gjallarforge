export const WEAPONS = {
    0: { tier: 0, name: "Plain Dagger of Initial Motions", dice: "1d4", numDice: 1, sides: 4 },
    1: { tier: 1, name: "Broadsword of Grunting", dice: "2d4", numDice: 2, sides: 4 },
    2: { tier: 2, name: "Tempered Longsword", dice: "3d8", numDice: 3, sides: 8 },
    3: { tier: 3, name: "Stone Maul of Earned Mass", dice: "4d12", numDice: 4, sides: 12 },
    4: { tier: 4, name: "Legendary Dragonbane", dice: "10d10", numDice: 10, sides: 10 },
};

export const calculateAvgWeaponDamage = (tier: number): number => {
    const w = WEAPONS[tier as keyof typeof WEAPONS];
    return w.numDice * (w.sides + 1) / 2;
};

export const getWeaponDropTier = (weekIndex: number, totalWeeks: number): number => {
    if (weekIndex >= totalWeeks - 1) return 4; // Legendary
    const progress = weekIndex / totalWeeks;
    if (progress < 0.25) return 1;
    if (progress < 0.55) return 2;
    return 3;
};
