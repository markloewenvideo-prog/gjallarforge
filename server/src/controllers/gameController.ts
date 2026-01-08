import { Request, Response } from 'express';
import { prisma } from '../db';
import { getIO } from '../socket';
import { WEAPONS } from '../constants';

// Combat helper logic moved into performAction for more granular log data

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

        // --- THE SWORD & THE DIE ---

        // 1. Roll d20
        const rawD20 = Math.floor(Math.random() * 20) + 1;

        // 2. Weapon Modifier
        const weapon = WEAPONS[participant.weaponTier as keyof typeof WEAPONS] || WEAPONS[0];
        const weaponBonus = parseInt(weapon.dice.replace('+', '')) || 0;

        // 3. Effective Roll (Clamped 1-20)
        const effectiveRoll = Math.min(20, Math.max(1, rawD20 + weaponBonus));

        let damage = 0;
        let quality = "";
        let dieSides = 0;
        let killed = false;
        let isAutoKill = false;

        // 4. Hit Quality Table & Damage calculation
        const numDice = Math.ceil(participant.level / 2);

        if (effectiveRoll === 20) {
            quality = "AUTO-KILL";
            damage = currentEnemy.hp; // Kill the beast
            killed = true;
            isAutoKill = true;
        } else if (effectiveRoll >= 16) {
            quality = "CRITICAL";
            dieSides = 10;
        } else if (effectiveRoll >= 11) {
            quality = "STRONG";
            dieSides = 8;
        } else if (effectiveRoll >= 6) {
            quality = "SOLID";
            dieSides = 6;
        } else if (effectiveRoll >= 2) {
            quality = "GLANCING";
            dieSides = 4;
        } else {
            quality = "MISS";
            damage = 0;
        }

        // Roll damage dice (Background)
        if (dieSides > 0 && !isAutoKill) {
            for (let i = 0; i < numDice; i++) {
                damage += Math.floor(Math.random() * dieSides) + 1;
            }
        }

        // --- UPDATE STATS ---
        const isNat20 = rawD20 === 20;
        const pipsToAdd = isNat20 ? 2 : 1;
        const isNat1 = rawD20 === 1;

        await prisma.participant.update({
            where: { id: participant.id },
            data: {
                totalWorkouts: { increment: pipsToAdd },
                workoutsThisWeek: { increment: pipsToAdd },
                isLootDisqualified: isNat1 ? true : undefined,
                bountyScore: { increment: rawD20 }, // Loot still follows Raw D20
                nat20Count: isNat20 ? { increment: 1 } : undefined,
                isInspired: isNat20 ? true : undefined,
                highestSingleRoll: {
                    set: Math.max((participant as any).highestSingleRoll, rawD20)
                },
                bountyScoreUpdatedAt: new Date()
            } as any
        });

        // Update Enemy
        await prisma.enemy.update({
            where: { id: currentEnemy.id },
            data: { hp: { decrement: damage } }
        });

        const updatedEnemy = await prisma.enemy.findUnique({ where: { id: currentEnemy.id } });
        if (updatedEnemy && updatedEnemy.hp <= 0) {
            killed = true;

            // Loot Determination
            const eligible = await prisma.participant.findMany({
                where: { campaignId, isLootDisqualified: false },
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

            await prisma.campaign.update({
                where: { id: campaignId },
                data: { currentEnemyIndex: { increment: 1 } }
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

        // Log the strike
        await prisma.logEntry.create({
            data: {
                campaignId,
                type: 'attack',
                content: JSON.stringify({
                    participantId,
                    participantName: participant.name,
                    enemyName: currentEnemy.name,
                    roll: rawD20,
                    modifier: weaponBonus,
                    effectiveRoll,
                    quality,
                    damage,
                    numDice,
                    dieSides,
                    hit: quality !== "MISS"
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
        res.json({ success: true, roll: rawD20, effectiveRoll, damage, killed, quality });

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

export const undoAction = async (req: Request, res: Response) => {
    try {
        const { campaignId, participantId } = req.body;

        if (!campaignId || !participantId) {
            res.status(400).json({ error: 'Missing parameters' });
            return;
        }

        // Find the most recent attack log for this participant in this campaign
        const lastLog = await prisma.logEntry.findFirst({
            where: {
                campaignId,
                type: 'attack'
            },
            orderBy: { timestamp: 'desc' }
        });

        if (!lastLog) {
            res.status(404).json({ error: 'No recent actions to undo' });
            return;
        }

        const logData = JSON.parse(lastLog.content);

        // Safety check: ensure the last log actually belongs to this participant 
        if (logData.participantId !== participantId) {
            res.status(400).json({ error: 'You can only undo your own most recent action' });
            return;
        }

        const { roll, damage, isCrit, hit, enemyName } = logData;

        // 1. Revert Participant Stats
        const pipsToSubtract = isCrit ? 2 : 1;
        await prisma.participant.update({
            where: { id: participantId },
            data: {
                totalWorkouts: { decrement: pipsToSubtract },
                workoutsThisWeek: { decrement: pipsToSubtract },
                bountyScore: { decrement: roll },
                nat20Count: isCrit ? { decrement: 1 } : undefined,
            } as any
        });

        // 2. Revert Enemy HP (if it was a hit)
        if (hit) {
            const enemy = await prisma.enemy.findFirst({
                where: { campaignId, name: enemyName }
            });

            if (enemy) {
                let killedReversion = false;

                // If the enemy was dead and this log was the killing blow...
                if (enemy.isDead && enemy.hp <= 0) {
                    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
                    if (campaign && campaign.currentEnemyIndex > 0) {
                        await prisma.campaign.update({
                            where: { id: campaignId },
                            data: { currentEnemyIndex: { decrement: 1 } }
                        });
                        killedReversion = true;
                    }
                }

                await prisma.enemy.update({
                    where: { id: enemy.id },
                    data: {
                        hp: { increment: damage },
                        isDead: killedReversion ? false : undefined,
                        lootWinnerId: killedReversion ? null : undefined
                    }
                });

                // Delete the "VANQUISHED" and "LOOT" system logs if we reverted a kill
                if (killedReversion) {
                    await prisma.logEntry.deleteMany({
                        where: {
                            campaignId,
                            type: 'system',
                            content: { contains: 'EVENT_VANQUISHED' }
                        }
                    });
                    await prisma.logEntry.deleteMany({
                        where: {
                            campaignId,
                            type: 'system',
                            content: { contains: 'EVENT_LOOT_CLAIMED' }
                        }
                    });
                }
            }
        }

        // 3. Delete the attack log
        await prisma.logEntry.delete({
            where: { id: lastLog.id }
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

        res.json({ success: true });
    } catch (error) {
        console.error('Undo error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
