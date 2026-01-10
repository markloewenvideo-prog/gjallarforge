
// Instead, let's just use Prisma to emulate the logic or verify the DB content if possible.
// Better: Write a script that CALLS the logic or copy-pastes the generation logic.

const calculateExpectedWeeklyDamage = (numParticipants, workoutsPerWeek) => {
    const avgDmg = 2.5;
    const p_hit = 0.6;
    return numParticipants * (p_hit * avgDmg * 1.05 * workoutsPerWeek);
};

async function testGeneration() {
    // Inputs
    const config = { workoutsPerWeek: 3, totalWeeks: 4 };
    const participantsNames = ['User'];

    const workoutsPerWeek = Number(config.workoutsPerWeek || 3);
    const totalWeeks = Math.max(1, Number(config.totalWeeks || config.weeks || 4));

    const P = participantsNames.length;
    const W = totalWeeks;

    // Logic copy-pasted from campaignController.ts

    const expectedInstakills = (P * (W * workoutsPerWeek)) * (1 / 20);
    let numNormalEnemies = Math.max(W, Math.round(expectedInstakills / 0.2));
    numNormalEnemies = Math.min(numNormalEnemies, W * 4);
    const totalEnemies = numNormalEnemies + 1;

    console.log('W:', W);
    console.log('numNormalEnemies:', numNormalEnemies);
    console.log('totalEnemies:', totalEnemies);

    const enemies = [];
    for (let i = 0; i < totalEnemies; i++) {
        const isFinalBoss = i === totalEnemies - 1;
        enemies.push({
            i,
            type: isFinalBoss ? 'BOSS' : 'REGULAR',
            order: isFinalBoss ? 500 : i
        });
    }

    console.log('Enemies:', enemies);
}

testGeneration();
