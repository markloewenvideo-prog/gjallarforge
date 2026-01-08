import { Request, Response } from 'express';
import { prisma } from '../db';
import { getIO } from '../socket';
import { WEAPONS } from '../constants';

// Helper to calculate damage
const calculateDamage = (weaponTier: number, strength: number) => {
    const w = WEAPONS[weaponTier as keyof typeof WEAPONS] || WEAPONS[0];
    const sides = w.sides;
    const numDice = w.numDice;

    let roll = 0;
    for (let i = 0; i < numDice; i++) {
        roll += Math.floor(Math.random() * sides) + 1;
    }

    // Add Strength (Level) to damage
    return roll + strength;
};

export const performAction = async (req: Request, res: Response) => {
    try {
        const { campaignId, participantId, type } = req.body;
        // type: 'attack'

        if (!campaignId || !participantId) {
            res.status(400).json({ error: 'Missing parameters' });
            return;
        }

        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: { enemies: true }
        });

        if (!campaign) {
            res.status(404).json({ error: 'Campaign not found' });
            return;
        }

        const currentEnemy = campaign.enemies.find(e => e.order === campaign.currentEnemyIndex);
        if (!currentEnemy || currentEnemy.isDead) {
            res.status(400).json({ error: 'No active enemy' });
            return;
        }

        const participant = await prisma.participant.findUnique({
            where: { id: participantId }
        });

        if (!participant) {
            res.status(404).json({ error: 'Participant not found' });
            return;
        }

        let logEntry;
        let damage = 0;
        let isCrit = false;
        let roll = 0;

        // Roll d20
        const rawRoll = Math.floor(Math.random() * 20) + 1;
        roll = rawRoll;
        const strengthBonus = participant.level;
        const totalRoll = rawRoll + strengthBonus;
        const isFumble = rawRoll === 1;
        isCrit = rawRoll === 20;

        const hit = totalRoll >= currentEnemy.ac || isCrit; // AC check with strength bonus

        // 1. Logging Effort (Strike = Workout)
        // Nat 20 = 2 pips, else 1 pip
        const pipsToAdd = isCrit ? 2 : 1;

        await prisma.participant.update({
            where: { id: participant.id },
            data: {
                totalWorkouts: { increment: pipsToAdd },
                workoutsThisWeek: { increment: pipsToAdd },
                isLootDisqualified: isFumble ? true : undefined, // Curse on Nat 1
                bountyScore: { increment: rawRoll },
                nat20Count: isCrit ? { increment: 1 } : undefined,
                isInspired: isCrit ? true : undefined,
                highestSingleRoll: {
                    set: Math.max((participant as any).highestSingleRoll, rawRoll)
                },
                bountyScoreUpdatedAt: new Date()
            } as any
        });

        let killed = false;
        if (hit) {
            damage = calculateDamage(participant.weaponTier, participant.level);
            if (isCrit) damage *= 2;

            // Update Enemy
            await prisma.enemy.update({
                where: { id: currentEnemy.id },
                data: {
                    hp: { decrement: damage }
                }
            });

            // Check death
            const updatedEnemy = await prisma.enemy.findUnique({ where: { id: currentEnemy.id } });
            if (updatedEnemy && updatedEnemy.hp <= 0) {
                killed = true;
                // Determine Loot Winner based on "Fair Sweat" rule:
                // 1. bountyScore (Sum of d20 rolls)
                // 2. nat20Count (Tie-breaker 1)
                // 3. highestSingleRoll (Tie-breaker 2)
                // 4. bountyScoreUpdatedAt (Tie-breaker 3 - First to reach)
                // Must not be cursed (isLootDisqualified)
                const eligible = await prisma.participant.findMany({
                    where: {
                        campaignId,
                        isLootDisqualified: false
                    },
                    orderBy: [
                        { bountyScore: 'desc' },
                        { nat20Count: 'desc' },
                        { highestSingleRoll: 'desc' },
                        { bountyScoreUpdatedAt: 'asc' }
                    ] as any
                });

                const winnerId = eligible[0]?.id || participant.id;

                await prisma.enemy.update({
                    where: { id: currentEnemy.id },
                    data: { isDead: true, lootWinnerId: winnerId }
                });

                // Advance campaign enemy index
                await prisma.campaign.update({
                    where: { id: campaignId },
                    data: {
                        currentEnemyIndex: { increment: 1 }
                    }
                });

                await prisma.logEntry.create({
                    data: {
                        campaignId,
                        type: 'system',
                        content: JSON.stringify({ message: `EVENT_VANQUISHED:${currentEnemy.name} has fallen! Victory to the forge!` })
                    }
                });

                await prisma.logEntry.create({
                    data: {
                        campaignId,
                        type: 'system',
                        content: JSON.stringify({
                            message: `EVENT_LOOT_CLAIMED:${eligible[0]?.name || participant.name} claims the loot!`,
                            winnerName: eligible[0]?.name || participant.name,
                            tier: currentEnemy.weaponDropTier
                        })
                    }
                });
            }
        }

        // Log
        logEntry = await prisma.logEntry.create({
            data: {
                campaignId,
                type: 'attack',
                content: JSON.stringify({
                    participantId,
                    participantName: participant.name,
                    enemyName: currentEnemy.name,
                    roll,
                    damage,
                    isCrit,
                    hit
                })
            }
        });

        // Emit update
        const io = getIO();
        const updatedCampaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                participants: true,
                enemies: true,
                logs: { orderBy: { timestamp: 'desc' }, take: 20 }
            }
        });

        io.to(campaignId).emit('gamestate_update', updatedCampaign);

        res.json({ success: true, roll, damage, killed });

    } catch (error) {
        console.error('Action error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


export const logWorkout = async (req: Request, res: Response) => {
    try {
        const { campaignId, participantId } = req.body;

        const participant = await prisma.participant.update({
            where: { id: participantId },
            data: {
                totalWorkouts: { increment: 1 },
                workoutsThisWeek: { increment: 1 }
                // TODO: level up logic every N workouts
            }
        });

        // Log it
        await prisma.logEntry.create({
            data: {
                campaignId,
                type: 'system',
                content: JSON.stringify({
                    message: `${participant.name} completed a workout!`
                })
            }
        });

        const io = getIO();
        const updatedCampaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                participants: true,
                enemies: true,
                logs: { orderBy: { timestamp: 'desc' }, take: 20 }
            }
        });
        io.to(campaignId).emit('gamestate_update', updatedCampaign);

        res.json(participant);
    } catch (error) {
        console.error('Workout log error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
