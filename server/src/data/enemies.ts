export interface EnemyData {
    name: string;
    description: string;
}

export const MONSTER_TIERS: Record<string, { regular: EnemyData[], funny: EnemyData[] }> = {
    WEAK: {
        regular: [
            { name: "Goblin Scout", description: "A nimble nuisance with a jagged blade and a nervous twitch." },
            { name: "Slime of Stagnation", description: "A pulsing green blob that smells of old gym bags and lost momentum." },
            { name: "Giant Rat", description: "A mange-ridden rodent that thrived on the scraps of ancient heroes." },
            { name: "Ooze of Indolence", description: "A sluggish puddle that tries to stick to your boots and slow your pace." },
            { name: "Skeletal Trainee", description: "The remains of a warrior who forgot to stretch. Rattles with every step." }
        ],
        funny: [
            { name: "Goblin of Mild Inconvenience", description: "Thrives on trivial obstacles such as weather or missing socks." },
            { name: "Warm-Up Wraith", description: "Encourages haste now and regret later with its chilly presence." },
            { name: "Skeleton of Past Attempts", description: "Rattles whenever you remember stopping last time." },
            { name: "Sir Reginald the Nearly Fit", description: "Has been “getting back into it” since the previous king’s reign." }
        ]
    },
    MEDIUM: {
        regular: [
            { name: "Orc-Bear", description: "A terrifying fusion of brute strength and animalistic fury. Half orc, half bear, all problem." },
            { name: "Bugbear Marauder", description: "A hairy, oversized goblinoid that swings a morningstar with reckless abandon." },
            { name: "Mist-Stalking Wraith", description: "A spectral horror that drains the warmth from your muscles." },
            { name: "Living Shadow", description: "A dark entity that mimics your movements, waiting for a moment of weakness." },
            { name: "Hobgoblin Captain", description: "A disciplined commander who leads with iron-clad strikes." }
        ],
        funny: [
            { name: "Sir Skips-Leg-Day", description: "Broad of chest, narrow of stance, and deeply suspicious of squats." },
            { name: "Barbell Mimic", description: "Appears manageable until touched, at which point it becomes emotionally heavier than expected." },
            { name: "Duke of Poor Form", description: "Once noble, now permanently bent. Offers advice with alarming confidence." },
            { name: "The Ghost of January 1st", description: "Possesses great energy, only to vanish after three weeks." }
        ]
    },
    HARD: {
        regular: [
            { name: "Frost Titan", description: "A mountain of ice that seeks to freeze the forge forever." },
            { name: "Iron Golem", description: "A massive construct of pure resilience. It does not tire." },
            { name: "Chimera of Doubt", description: "Three heads, each whispering a reason why you should stop." },
            { name: "Eldritch Mindflayer", description: "A tentacled horror that seeks to consume your focus and ambition." }
        ],
        funny: [
            { name: "The Titan of Tainted Protein", description: "A massive biological horror that smells faintly of spoiled vanilla." },
            { name: "Overthinking Beholder", description: "Each eye projects a different plan. None of them involve starting." },
            { name: "Snacking Hydra", description: "Cut one craving down and two more appear, each louder than the last." },
            { name: "Ogre of Overdoing It", description: "Believes more is always better and rest is cowardice." }
        ]
    },
    BOSS: {
        regular: [
            { name: "Ancient Cinder Dragon", description: "The ultimate lord of the forge. Its scales are tempered in a thousand cycles." },
            { name: "Gjallar-Blight Wyrm", description: "A catastrophic beast of infinite greed that has swallowed whole civilizations of effort." },
            { name: "Void-Scale Devourer", description: "A dragon of pure absence, eating the very light of your ambition." },
            { name: "Iron-Winged Tyrant", description: "Its wings are massive sheets of rusted plate, grinding with every beat." }
        ],
        funny: [
            { name: "The Squat-Thrust Wyrm", description: "A massive dragon that only attacks after a punishing set of descent and ascent." },
            { name: "Bench-Press Blast-Breath", description: "This dragon’s chest is so broad it literal blocks out the sun." },
            { name: "The Cardio-Cramp Drake", description: "A spindly, frantic dragon that causes side-splitting pain by looking at it." },
            { name: "Deadlift Dread-King", description: "A dragon made of solid granite plates. Lifting its gaze is harder than lifting its tail." }
        ]
    },
    SHADOW: {
        regular: [
            { name: "Shadow Monster", description: "A formless manifestation of lost Oaths. It clings to the heels of the fellowship." },
            { name: "Void Stalker", description: "A shadow that feeds on the heat of your exertion." },
            { name: "Echo of Weakness", description: "A flickering image of the moments you chose rest over the forge." }
        ],
        funny: [
            { name: "The Sentient Sweat-Towel", description: "Damp, heavy, and clings to you with unwanted affection." },
            { name: "Phantom of Bad Music", description: "Haunts training halls with songs no one chose." }
        ]
    }
};

// Supporting compatibility
export const FUNNY_MONSTERS = Object.values(MONSTER_TIERS).flatMap(t => t.funny);
export const EPIC_DRAGONS = MONSTER_TIERS.BOSS.funny.concat(MONSTER_TIERS.BOSS.regular);
export const REGULAR_MONSTERS = {
    early: MONSTER_TIERS.WEAK.regular,
    mid: MONSTER_TIERS.MEDIUM.regular,
    late: MONSTER_TIERS.HARD.regular,
    boss: MONSTER_TIERS.BOSS.regular
};
