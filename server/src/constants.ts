export const WEAPONS = {
    0: { tier: 0, name: "Unarmed Strike", dice: "+0", numDice: 0, sides: 0 },
    1: { tier: 1, name: "Rusty Dagger", dice: "+1", numDice: 1, sides: 4 },
    2: { tier: 2, name: "Broadsword", dice: "+2", numDice: 2, sides: 4 },
    3: { tier: 3, name: "War Hammer", dice: "+3", numDice: 3, sides: 8 },
    4: { tier: 4, name: "Great Axe", dice: "+4", numDice: 4, sides: 12 },
    5: { tier: 5, name: "Legendary Dragonbane", dice: "+5", numDice: 10, sides: 10 },
};

export const calculateAvgWeaponDamage = (tier: number): number => {
    const w = WEAPONS[tier as keyof typeof WEAPONS] || WEAPONS[0];
    return parseInt(w.dice.replace('+', '')) || 0;
};

export const getWeaponDropTier = (weekIndex: number, totalWeeks: number): number => {
    if (weekIndex >= totalWeeks - 1) return 5; // Legendary
    const progress = weekIndex / totalWeeks;
    if (progress < 0.25) return 1;
    if (progress < 0.55) return 2;
    if (progress < 0.8) return 3;
    return 4;
};
