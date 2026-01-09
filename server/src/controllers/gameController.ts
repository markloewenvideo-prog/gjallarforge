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

        // --- THE IRON PATH (Simplified) ---

        // 1. Roll d20
        const rawD20 = Math.floor(Math.random() * 20) + 1;

        // 2. Weapon Modifier
        const weapon = WEAPONS[participant.weaponTier as keyof typeof WEAPONS] || WEAPONS[0];
        const weaponBonus = parseInt(weapon.dice.replace('+', '')) || 0;

        // 3. Strength (Level)
        const strength = participant.level;

        // 4. Total Damage = D20 + Strength + Weapon Bonus
        let damage = rawD20 + strength + weaponBonus;
        let isCrit = false;
        let isMiss = false;

        if (rawD20 === 20) {
            damage = currentEnemy.hp; // Instant Kill
            isCrit = true;
        } else if (rawD20 === 1) {
            damage = 0;
            isMiss = true;
        }

        const isNat20 = rawD20 === 20;

        // --- UPDATE STATS ---
        // --- UPDATE STATS ---
        const pipsToAdd = isNat20 ? 2 : 1;

        console.log(`[DEBUG] Updating pips for ${participant.name}: +${pipsToAdd}`);

        const [updatedParticipant, _enemyUpdate] = await prisma.$transaction([
            prisma.participant.update({
                where: { id: participant.id },
                data: {
                    totalWorkouts: { increment: pipsToAdd },
                    workoutsThisWeek: { increment: pipsToAdd },
                    bountyScore: { increment: rawD20 },
                    nat20Count: isNat20 ? { increment: 1 } : undefined,
                    highestSingleRoll: {
                        set: Math.max((participant as any).highestSingleRoll, rawD20)
                    },
                    bountyScoreUpdatedAt: new Date()
                } as any
            }),
            prisma.enemy.update({
                where: { id: currentEnemy.id },
                data: { hp: { decrement: damage } }
            })
        ]);

        const updatedEnemy = await prisma.enemy.findUnique({ where: { id: currentEnemy.id } });
        let isKill = false;
        if (updatedEnemy && updatedEnemy.hp <= 0) {
            isKill = true;

            let winnerId = null;
            if (currentEnemy.weaponDropTier > 0) {
                const eligible = await prisma.participant.findMany({
                    where: { campaignId, isLootDisqualified: false },
                    orderBy: [
                        { bountyScore: 'desc' },
                        { nat20Count: 'desc' },
                        { highestSingleRoll: 'desc' },
                        { bountyScoreUpdatedAt: 'asc' }
                    ] as any
                });
                winnerId = eligible[0]?.id || participant.id;

                // Update winner's weapon armament if the new weapon is better
                const winner = await prisma.participant.findUnique({ where: { id: winnerId } });
                if (winner && currentEnemy.weaponDropTier > winner.weaponTier) {
                    await prisma.participant.update({
                        where: { id: winnerId },
                        data: { weaponTier: currentEnemy.weaponDropTier }
                    });
                }
            }

            await prisma.enemy.update({
                where: { id: currentEnemy.id },
                data: { isDead: true, lootWinnerId: winnerId }
            });

            await prisma.campaign.update({
                where: { id: campaignId },
                data: { currentEnemyIndex: { increment: 1 } }
            });

            const nextEnemyIndex = campaign.currentEnemyIndex + 1;
            const nextEnemy = campaign.enemies.find(e => e.order === nextEnemyIndex);

            if (nextEnemy && (nextEnemy.name.includes("Shadow") || nextEnemy.name.startsWith("The Shadow of"))) {
                if (!currentEnemy.name.includes("Shadow") && !currentEnemy.name.startsWith("The Shadow of")) {
                    await prisma.logEntry.create({
                        data: {
                            campaignId,
                            type: 'system',
                            content: JSON.stringify({ message: "EVENT_SHADOW_REALM: The fellowship crosses the threshold. Eternal night awaits." })
                        }
                    });
                }
            }

            if (winnerId) {
                const winner = await prisma.participant.findUnique({ where: { id: winnerId } });
                await prisma.logEntry.create({
                    data: {
                        campaignId,
                        type: 'system',
                        content: JSON.stringify({
                            message: `EVENT_LOOT_CLAIMED:${winner?.name || "A hero"} claims the loot!`,
                            winnerName: winner?.name || "A hero",
                            tier: currentEnemy.weaponDropTier
                        })
                    }
                });
            }
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
                    isCrit,
                    isMiss,
                    modifier: weaponBonus,
                    strength,
                    damage,
                    hit: !isMiss
                })
            }
        });

        // Emit update
        const io = getIO();
        const updatedCampaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                participants: { orderBy: { id: 'asc' } },
                enemies: { orderBy: { order: 'asc' } },
                logs: { orderBy: { timestamp: 'desc' }, take: 50 }
            }
        });

        if (updatedCampaign) {
            io.to(campaignId).emit('gamestate_update', updatedCampaign);
        }

        res.json({
            success: true,
            roll: rawD20,
            damage,
            killed: isKill,
            isCrit,
            isMiss,
            strength,
            modifier: weaponBonus,
            campaign: updatedCampaign
        });

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

        res.json({ campaign: updatedCampaign, participant });
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

        const { roll, damage, hit, enemyName } = logData;
        const isCrit = logData.isCrit ?? (roll === 20);

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

        res.json({ success: true, campaign: updatedCampaign });
    } catch (error) {
        console.error('Undo error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
