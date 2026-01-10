export const WEAPONS = {
    0: { tier: 0, name: "Unarmed Strike", bonus: 0 },
    1: { tier: 1, name: "Rusty Dagger", bonus: 1 },
    2: { tier: 2, name: "Broadsword", bonus: 2 },
    3: { tier: 3, name: "War Hammer", bonus: 3 },
    4: { tier: 4, name: "Great Axe", bonus: 4 },
    5: { tier: 5, name: "Legendary Dragonbane", bonus: 5 },
    6: { tier: 6, name: "Mythril Cleaver", bonus: 6 },
    7: { tier: 7, name: "Stormforged Maul", bonus: 7 },
    8: { tier: 8, name: "Soulrender's Edge", bonus: 8 },
    9: { tier: 9, name: "Titan's Reckoning", bonus: 9 },
    10: { tier: 10, name: "The Big Dick of Swinging", bonus: 10 },
    11: { tier: 11, name: "Voidbreaker", bonus: 11 },
    12: { tier: 12, name: "Starfall Blade", bonus: 12 },
    13: { tier: 13, name: "Eternity's Grasp", bonus: 13 },
    14: { tier: 14, name: "Worldshatter", bonus: 14 },
    15: { tier: 15, name: "Oblivion's Fang", bonus: 15 },
    16: { tier: 16, name: "Primordial Crusher", bonus: 16 },
    17: { tier: 17, name: "Infinity's Edge", bonus: 17 },
    18: { tier: 18, name: "Celestial Annihilator", bonus: 18 },
    19: { tier: 19, name: "Chronos Breaker", bonus: 19 },
    20: { tier: 20, name: "Reality Render", bonus: 20 },
};

// Helper function to get weapon data for any tier, including 21+
export const getWeapon = (tier: number) => {
    if (tier <= 20) {
        return WEAPONS[tier as keyof typeof WEAPONS] || WEAPONS[0];
    }
    // Tier 21+ is "Cosmic Power"
    return { tier, name: "Cosmic Power", bonus: tier };
};

export const calculateAvgWeaponDamage = (tier: number): number => {
    return getWeapon(tier).bonus;
};

export const getWeaponDropTier = (weekIndex: number, totalWeeks: number): number => {
    if (weekIndex >= totalWeeks - 1) return 5; // Legendary
    const progress = weekIndex / totalWeeks;
    if (progress < 0.25) return 1;
    if (progress < 0.55) return 2;
    if (progress < 0.8) return 3;
    return 4;
};

// Calculate weapon tier dynamically based on current cycle using normal distribution
export const calculateWeaponTierForCycle = (currentCycle: number): number => {
    // Generate normally distributed random number using Box-Muller transform
    // Mean = currentCycle, Standard Deviation = 1.5 (allows spread but keeps most near center)
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const normalValue = currentCycle + (z0 * 1.5);

    // Round to nearest integer, minimum at 0, no upper cap
    return Math.max(0, Math.round(normalValue));
};
