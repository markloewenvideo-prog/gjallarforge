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

        let winnerId: string | null = null;
        let winnerInfo: any = null;

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
        const originalRoll = Math.floor(Math.random() * 20) + 1;
        let rawD20 = originalRoll;
        let modificationReason: string | null = null;

        // --- INSPIRED PROTECTION & CURSED HINDRANCE ---
        if (rawD20 === 1 && participant.isInspired) {
            rawD20 = 2; // Bump 1 to 2
            modificationReason = "inspiration";
        } else if (rawD20 === 20 && participant.isCursed) {
            rawD20 = 19; // Bump 20 to 19
            modificationReason = "curse";
        }

        // 2. Weapon Modifier
        const weapon = WEAPONS[participant.weaponTier as keyof typeof WEAPONS] || WEAPONS[0];
        const weaponBonus = parseInt(weapon.dice.replace('+', '')) || 0;

        // 3. Strength (Level)
        const strength = participant.level;

        // 4. Total Damage = D20 + Strength + Weapon Bonus
        let damage = rawD20 + strength + weaponBonus;
        let isCrit = false;
        let isMiss = false;

        const isShadowMonster = currentEnemy.hp <= 10 && currentEnemy.weaponDropTier === 0;
        const isFinalBoss = currentEnemy.order === (Number(JSON.parse(campaign.config).totalWeeks || 4) - 1);

        if (rawD20 === 20 || (rawD20 >= 2 && participant.isBlessed && isShadowMonster)) {
            if (isFinalBoss) {
                // Double Damage for Final Boss on Nat 20
                damage = (rawD20 + strength + weaponBonus) * 2;
                isCrit = true;
                modificationReason = "double_damage";
            } else {
                // Instant Kill for others (and Blessed vs Shadows)
                damage = currentEnemy.hp;
                isCrit = true;
            }
        } else if (rawD20 === 1) {
            damage = 0;
            isMiss = true;
        }

        const isNat20 = rawD20 === 20;

        // --- UPDATE STATS ---
        // --- UPDATE STATS ---
        const pipsToAdd = 1;

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

        // Log the strike FIRST for narrative consistency
        await prisma.logEntry.create({
            data: {
                campaignId,
                type: 'attack',
                content: JSON.stringify({
                    participantId,
                    participantName: participant.name,
                    enemyName: currentEnemy.name,
                    roll: rawD20,
                    originalRoll,
                    modificationReason,
                    isCrit,
                    isMiss,
                    modifier: weaponBonus,
                    strength,
                    damage,
                    hit: !isMiss
                })
            }
        });

        const updatedEnemy = await prisma.enemy.findUnique({ where: { id: currentEnemy.id } });
        let isKill = false;
        if (updatedEnemy && updatedEnemy.hp <= 0) {
            isKill = true;

            if (currentEnemy.weaponDropTier > 0) {
                // Fetch all participants sorted by Bounty Score (The Fair Sweat Rule)
                // Cursed players are back in the loot pool!
                const participants = await prisma.participant.findMany({
                    where: { campaignId },
                    orderBy: [
                        { bountyScore: 'desc' },
                        { nat20Count: 'desc' },
                        { highestSingleRoll: 'desc' },
                        { bountyScoreUpdatedAt: 'asc' }
                    ] as any
                });

                // Find the highest roller who doesn't already have this tier (or better)
                // If everyone is geared up, the top roller keeps the prestige (or loot is lost to the forge)
                // Let's find the first person who would actually benefit.
                let winner = participants.find(p => p.weaponTier < currentEnemy.weaponDropTier);

                // If no one is eligible (everyone has better/equal), default to the actual top roller
                if (!winner && participants.length > 0) {
                    winner = participants[0];
                }

                winnerId = winner?.id || participant.id;

                // Update winner's weapon armament (Only if not a Shadow Monster)
                const isShadowMonster = currentEnemy.weaponDropTier === 0;
                if (!isShadowMonster && winner && currentEnemy.weaponDropTier > winner.weaponTier) {
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

            const config = JSON.parse(campaign.config);
            const totalWeeks = Number(config.totalWeeks || config.weeks || 4);
            const threshold = totalWeeks - 1;

            if (currentEnemy.order < threshold && (campaign.currentEnemyIndex + 1) >= threshold) {
                // --- APPLY BLESSED STATUS ---
                const participants = await prisma.participant.findMany({ where: { campaignId } });
                const workoutsPerWeek = Number(config.workoutsPerWeek || 3);
                const weekThreshold = threshold; // e.g. entering week 4, threshold is 3
                const totalPossible = workoutsPerWeek * weekThreshold;

                for (const p of participants) {
                    if (p.totalWorkouts >= totalPossible) {
                        await prisma.participant.update({
                            where: { id: p.id },
                            data: { isBlessed: true, isInspired: false }
                        });
                    }
                }

                await prisma.logEntry.create({
                    data: {
                        campaignId,
                        type: 'system',
                        content: JSON.stringify({ message: "EVENT_SHADOW_REALM: The fellowship crosses the threshold. Those who kept their Oaths are BLESSED." })
                    }
                });
            }

            if (winnerId) {
                winnerInfo = await prisma.participant.findUnique({ where: { id: winnerId } });
                await prisma.logEntry.create({
                    data: {
                        campaignId,
                        type: 'system',
                        content: JSON.stringify({
                            message: `EVENT_LOOT_CLAIMED:${winnerInfo?.name || "A hero"} claims the loot!`,
                            winnerName: winnerInfo?.name || "A hero",
                            tier: currentEnemy.weaponDropTier
                        })
                    }
                });
            }
        }

        // Emit update
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

        res.json({
            success: true,
            roll: rawD20,
            damage,
            killed: isKill,
            isCrit,
            isMiss,
            strength,
            modifier: weaponBonus,
            campaign: updatedCampaign,
            winnerName: winnerInfo?.name,
            winnerLevel: winnerInfo?.level,
            tier: isKill ? currentEnemy.weaponDropTier : 0,
            originalRoll,
            modificationReason
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
