export interface EnemyData {
    name: string;
    description: string;
}

export const MONSTER_TIERS: Record<string, { regular: EnemyData[], funny: EnemyData[] }> = {
    T1: {
        regular: [
            { name: "Goblin Scout", description: "A nimble nuisance with a jagged blade and a nervous twitch." },
            { name: "Slime of Stagnation", description: "A pulsing green blob that smells of old gym bags and lost momentum." },
            { name: "Giant Rat", description: "A mange-ridden rodent that thrived on the scraps of ancient heroes." },
            { name: "Skeletal Trainee", description: "The remains of a warrior who forgot to stretch. Rattles with every step." }
        ],
        funny: [
            { name: "Goblin of Mild Inconvenience", description: "Thrives on trivial obstacles such as weather or missing socks." },
            { name: "Warm-Up Wraith", description: "Encourages haste now and regret later with its chilly presence." },
            { name: "Skeleton of Past Attempts", description: "Rattles whenever you remember stopping last time." },
            { name: "Sir Reginald the Nearly Fit", description: "Has been “getting back into it” since the previous king’s reign." }
        ]
    },
    T2: {
        regular: [
            { name: "Orc-Bear", description: "A terrifying fusion of brute strength and animalistic fury. Half orc, half bear, all problem." },
            { name: "Bugbear Marauder", description: "A hairy, oversized goblinoid that swings a morningstar with reckless abandon." },
            { name: "Hobgoblin Captain", description: "A disciplined commander who leads with iron-clad strikes." },
            { name: "Iron-Hided Boar", description: "A massive beast that charges with the force of a falling anvil." }
        ],
        funny: [
            { name: "Sir Skips-Leg-Day", description: "Broad of chest, narrow of stance, and deeply suspicious of squats." },
            { name: "Barbell Mimic", description: "Appears manageable until touched, at which point it becomes emotionally heavier than expected." },
            { name: "Duke of Poor Form", description: "Once noble, now permanently bent. Offers advice with alarming confidence." },
            { name: "Phantom of Bad Music", description: "Haunts training halls with songs no one chose." }
        ]
    },
    T3: {
        regular: [
            { name: "Mist-Stalking Wraith", description: "A spectral horror that drains the warmth from your muscles." },
            { name: "Living Shadow", description: "A dark entity that mimics your movements, waiting for a moment of weakness." },
            { name: "Cursed Plate Armor", description: "A hollow suit of steel that fights with the memories of its fallen owner." },
            { name: "Flame-Wreathed Orc", description: "A warrior born in the heart of a furnace, swinging a burning hammer." }
        ],
        funny: [
            { name: "Wobbly Lich of Lost Motivation", description: "An ancient being sustained entirely by waiting to feel ready." },
            { name: "Cardio Banshee", description: "Its shriek can be heard whenever running is mentioned casually." },
            { name: "The Ghost of January 1st", description: "Possesses great energy, only to vanish after three weeks." },
            { name: "Specter of Public Judgment", description: "Convinced everyone in the room is watching you specifically." }
        ]
    },
    T4: {
        regular: [
            { name: "Eldritch Mindflayer", description: "A tentacled horror that seeks to consume your focus and ambition." },
            { name: "Gorgon Sentinel", description: "A stone-skinned creature whose gaze can halt any momentum." },
            { name: "Chimera of Doubt", description: "Three heads, each whispering a reason why you should stop." },
            { name: "Void Stalker", description: "A shadow that feeds on the heat of your exertion." }
        ],
        funny: [
            { name: "Overthinking Beholder", description: "Each eye projects a different plan. None of them involve starting." },
            { name: "The Gorgon of Gaunt Glances", description: "One look from this creature can turn your motivation to stone." },
            { name: "Snacking Hydra", description: "Cut one craving down and two more appear, each louder than the last." },
            { name: "The Sentient Sweat-Towel", description: "Damp, heavy, and clings to you with unwanted affection." }
        ]
    },
    T5: {
        regular: [
            { name: "Frost Titan", description: "A mountain of ice that seeks to freeze the forge forever." },
            { name: "Iron Golem", description: "A massive construct of pure resilience. It does not tire." },
            { name: "Hydra of Habits", description: "Sever one old routine, and three new distractions sprout in its place." },
            { name: "Plateau Giant", description: "A vast creature that insists nothing has changed, despite clear evidence." }
        ],
        funny: [
            { name: "The Titan of Tainted Protein", description: "A massive biological horror that smells faintly of spoiled vanilla." },
            { name: "Invisible Dragon of Expectations", description: "Terrifying, vast, and entirely imagined." },
            { name: "Ogre of Overdoing It", description: "Believes more is always better and rest is cowardice." },
            { name: "The Hoarder of Hex-Dumbbells", description: "Surrounded by a fortress of paired weights it will never use." }
        ]
    },
    T6: {
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
    }
};

// Supporting compatibility for a bit if needed, but we should migrate
export const FUNNY_MONSTERS = Object.values(MONSTER_TIERS).flatMap(t => t.funny);
export const EPIC_DRAGONS = MONSTER_TIERS.T6.funny.concat(MONSTER_TIERS.T6.regular);
export const REGULAR_MONSTERS = {
    early: MONSTER_TIERS.T1.regular.concat(MONSTER_TIERS.T2.regular),
    mid: MONSTER_TIERS.T3.regular.concat(MONSTER_TIERS.T4.regular),
    late: MONSTER_TIERS.T5.regular,
    boss: MONSTER_TIERS.T6.regular
};
