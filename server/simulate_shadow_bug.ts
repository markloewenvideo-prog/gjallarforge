
import { PrismaClient } from '@prisma/client';
import { performAction } from './src/controllers/gameController';
import { createCampaign, joinCampaign } from './src/controllers/campaignController';

const prisma = new PrismaClient();

// Mock Express Objects
const mockReq = (body: any) => ({ body, params: body } as any);
const mockRes = () => {
    const res: any = {};
    res.status = (code: number) => { res.statusCode = code; return res; };
    res.json = (data: any) => { res.data = data; return res; };
    return res;
};

// Mock getIO directly by overwriting the property on the required module if possible, 
// OR just rely on the fact that we aren't starting the express server so getIO might be undefined or we can shim it.
// Actually, let's just shim the function if it's exported.
// Since we are running this as a script, we can't easily mock ES modules without a loader.
// Let's just create a dummy "socket.ts" replacement or ignore it.
// The controller imports `getIO` from `../socket`.
// If we run with `tsx`, it resolves the real file. The real file probably exports `getIO`.
// Let's assume `getIO` throws if not initialized? 
// Checking socket.ts content would be good.

// We can't easily mock imports in this script without jest, 
// so let's just use the PRISMA calls directly to simulate the flow 
// OR use the actual controllers if we can shim the socket.

// Let's rely on direct Prisma manipulation to match the controller logic
// effectively re-implementing the "Action" logic to see what happens to the state.

async function runSimulation() {
    console.log("Starting simulation with FULL CREATE LOGIC...");

    // COPY OF CREATE CAMPAIGN LOGIC
    const config = { workoutsPerWeek: 3, totalWeeks: 4 };
    const participantsNames = ["Hero"];

    // Config parsing
    const workoutsPerWeek = 3;
    const totalWeeks = 4;
    const numParticipants = 1;

    // Enemy Calc
    const expectedInstakills = (numParticipants * (totalWeeks * workoutsPerWeek)) * (1 / 20);
    let numNormalEnemies = Math.max(totalWeeks, Math.round(expectedInstakills / 0.2));
    numNormalEnemies = Math.min(numNormalEnemies, totalWeeks * 4);
    const totalEnemies = numNormalEnemies + 1;

    console.log(`Generating ${totalEnemies} enemies...`);

    const generatedMonsterData: any[] = [];
    for (let i = 0; i < totalEnemies; i++) {
        generatedMonsterData.push({
            name: `Enemy ${i}`,
            description: "Desc",
            hp: 10,
            maxHp: 10,
            ac: 10,
            level: 1,
            type: i === totalEnemies - 1 ? 'BOSS' : 'REGULAR',
            weaponDropTier: 0,
            order: i === totalEnemies - 1 ? 500 : i,
            isDead: false
        });
    }

    // DB Creation
    const campaign = await prisma.campaign.create({
        data: {
            name: "Duplicate Test",
            config: JSON.stringify(config),
            currentWeek: 1,
            currentEnemyIndex: 0,
            enemies: { create: generatedMonsterData }
        },
        include: { enemies: true }
    });

    console.log(`Campaign Created. Enemy Count: ${campaign.enemies.length}`);
    const duplicates = campaign.enemies.filter((e, i, a) => a.findIndex(x => x.order === e.order) !== i);
    console.log(`Duplicate Orders Found: ${duplicates.length}`);
    if (duplicates.length > 0) {
        console.log("FAIL: Duplicates detected!");
        duplicates.forEach(d => console.log(`Dup: Order ${d.order}`));
    }

    // Create Participant
    const user = await prisma.user.create({ data: { username: `Tester_${Date.now()}`, passwordHash: "x" } });
    const participant = await prisma.participant.create({
        data: { campaignId: campaign.id, userId: user.id, name: "Hero", level: 1, weaponTier: 1 }
    });

    // SIMULATE ATTACKS
    console.log("Simulating 5 attacks...");
    for (let i = 0; i < 5; i++) {
        // FIND TARGET (Logic from performAction)
        const currentCampaign = await prisma.campaign.findUnique({ where: { id: campaign.id }, include: { enemies: true } });
        const currentEnemy = (currentCampaign!.enemies || [])
            .filter((e: any) => !e.isDead && e.order >= currentCampaign!.currentEnemyIndex)
            .sort((a: any, b: any) => a.order - b.order)[0];

        if (!currentEnemy) { console.log("No enemy found!"); break; }

        console.log(`Attack ${i + 1}: Targeting ${currentEnemy.name} (ID: ${currentEnemy.id.substring(0, 4)}..., Order: ${currentEnemy.order}, Tier: ${currentEnemy.weaponDropTier})`);

        // TIER CHECK LOG
        if (currentEnemy.weaponDropTier === 0) {
            console.log(`[LOG] A New Threat Emerges: ${currentEnemy.name}`);
            await prisma.enemy.update({ where: { id: currentEnemy.id }, data: { weaponDropTier: 1 } });
        }

        // DAMAGE
        await prisma.enemy.update({ where: { id: currentEnemy.id }, data: { hp: { decrement: 2 } } });

        // KILL CHECK
        const latest = await prisma.enemy.findUnique({ where: { id: currentEnemy.id } });
        if (latest!.hp <= 0 && !latest!.isDead) {
            await prisma.enemy.update({ where: { id: currentEnemy.id }, data: { isDead: true } });
            await prisma.campaign.update({ where: { id: campaign.id }, data: { currentEnemyIndex: { increment: 1 } } });
            console.log(`[KILL] ${currentEnemy.name} defeated!`);
        }
    }

    // 3. CHECK STATE
    const updatedCampaign = await prisma.campaign.findUnique({
        where: { id: campaign.id },
        include: { enemies: { orderBy: { order: 'asc' } } }
    });

    console.log(`Updated Index: ${updatedCampaign?.currentEnemyIndex}`);

    // What would the frontend see?
    const nextEnemy = updatedCampaign?.enemies.filter(e => !e.isDead && e.order >= (updatedCampaign.currentEnemyIndex || 0)).sort((a, b) => a.order - b.order)[0];

    console.log(`Frontend Next Enemy: ${nextEnemy?.name}`);
    console.log(`Frontend Next Type: ${nextEnemy?.type}`);

    if (!nextEnemy || nextEnemy.type === 'SHADOW' || nextEnemy.type === 'BOSS') {
        console.log("FAIL: Shadow Realm Triggered!");
    } else {
        console.log("SUCCESS: Normal Progression.");
    }

    // Clean up
    await prisma.participant.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.enemy.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.user.delete({ where: { id: user.id } });
}

runSimulation();
