export interface WeaponData {
    name: string;
    dice: string;
    numDice: number;
    sides: number;
}

export const FUNNY_WEAPONS: Record<number, WeaponData[]> = {
    0: [
        { name: "Plain Dagger of Initial Motions", dice: "1d4", numDice: 1, sides: 4 },
        { name: "Guild-Issued Mace of Regular Attendance", dice: "1d6", numDice: 1, sides: 6 }
    ],
    1: [
        { name: "Laminated Blade of the West Stair", dice: "2d4", numDice: 2, sides: 4 },
        { name: "Iron Flail of Considerable Weight", dice: "1d8", numDice: 1, sides: 8 },
        { name: "Magical Axe of Grunting", dice: "2d4", numDice: 2, sides: 4 }
    ],
    2: [
        { name: "Tempered Longsword of Repeated Use", dice: "3d6", numDice: 3, sides: 6 },
        { name: "Workman’s Battleaxe of Lower Commitment", dice: "2d8", numDice: 2, sides: 8 },
        { name: "Runed Hammer of Measured Effort", dice: "3d6", numDice: 3, sides: 6 }
    ],
    3: [
        { name: "Stone Maul of Earned Mass", dice: "4d6", numDice: 4, sides: 6 },
        { name: "Overwrought Greatsword of Questionable Readiness", dice: "2d12", numDice: 2, sides: 12 }
    ],
    4: [
        { name: "Legendary Dragonbane", dice: "10d10", numDice: 10, sides: 10 }
    ]
};

export const ENEMY_SPELLS = [
    "Glare of the Juiced-Up Gym Bro",
    "Vicious Mockery (Passive-Aggressive Variant)",
    "Aura of Unsolicited Advice",
    "Judgmental Flex of the Mirror Realm",
    "Curse of “You Should Be Further Along”",
    "Hex of Comparative Progress",
    "Psychic Shove of Gymtimidation",
    "The Thousand-Yard Stare of the Pre-Workout Overdose",
    "Weight-Re-Racking Ritual (Actually a Trap)",
    "The Shaker Bottle Symphonic Screech",
    "The Untied Shoelace Trip-wire",
    "The Ghost of a Perfect Rep",
    "The Inevitable Sweat-Patch Puddle",
    "The 'I'm Not Even Using This' Hoard-Hex",
    "The Chrono-Lock of the 2-Hour Talker",
    "The Delusion of a 'Quick Set'",
    "The Spectral Spotter Who Isn't Helping"
];
