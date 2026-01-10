import { Request, Response } from 'express';
import { prisma } from '../db';
import { MONSTER_TIERS } from '../data/enemies';
import { ENEMY_SPELLS } from '../data/content';
import { calculateAvgWeaponDamage, getWeaponDropTier } from '../constants';
import { getIO } from '../socket';
import bcrypt from 'bcryptjs';

// Helper for damage calculation
const calculateExpectedWeeklyDamage = (numParticipants: number, workoutsPerWeek: number): number => {
    // Avg tier 0 damage = 2.5
    // Hit chance approx 0.6
    // Crit multiplier 1.05
    const avgDmg = 2.5;
    const p_hit = 0.6;
    // Total expected damage per week by all participants
    return numParticipants * (p_hit * avgDmg * 1.05 * workoutsPerWeek);
};

export const createCampaign = async (req: Request, res: Response) => {
    try {
        const { name: rawName, config: rawConfig, participantsNames, initialEnemy } = req.body;
        const config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;

        let name = (rawName || "").trim();
        if (!name) {
            const count = await prisma.campaign.count();
            name = `Forge ${count + 1}`;
        }

        if (!config || !participantsNames || !Array.isArray(participantsNames)) {
            return res.status(400).json({ error: "Missing required fields or invalid participants list" });
        }

        const workoutsPerWeek = Number(config.workoutsPerWeek || 3);
        const totalWeeks = Math.max(1, Number(config.totalWeeks || config.weeks || 4));

        // --- ADVANCED HP SCALING MODEL ---
        const P = participantsNames.length;
        const W = totalWeeks;
        const A = workoutsPerWeek;
        const T = W * A; // Total attacks per player
        const efficiencyFactor = 0.85; // η
        const difficultyMultiplier = 1.15; // k
        const instakillBurnFactor = 18 / 20; // Accounts for Nat-1 misses and Nat-20 skips

        // 1. Calculate Campaign HP Budget
        let totalHPBurn = 0;
        for (let t = 0; t < T; t++) {
            const currentWeek = Math.floor(t / A);
            const levelAtAttack = 1 + currentWeek; // Players level up weekly
            const weaponModAtAttack = Math.floor(currentWeek / 2); // Loose assumption: Tier up every 2 weeks
            const expectedDamage = (10.5 + levelAtAttack + weaponModAtAttack);
            totalHPBurn += expectedDamage * instakillBurnFactor;
        }
        const campaignHPBudget = Math.ceil(totalHPBurn * P * efficiencyFactor * difficultyMultiplier);

        // 2. Determine Enemy Counts (Instakill Heuristic)
        const expectedInstakills = (P * T) * (1 / 20);
        // choose the number of non-boss enemies so that instakills remove roughly 20% of them
        // Floor at W (at least 1 per week) and cap density at 4 per week to prevent slog
        let numNormalEnemies = Math.max(W, Math.round(expectedInstakills / 0.2));
        numNormalEnemies = Math.min(numNormalEnemies, W * 4);
        const totalEnemies = numNormalEnemies + 1;

        // 3. Allocate HP Pool
        const bossHP = Math.ceil(campaignHPBudget * 0.25);
        const normalHPPool = campaignHPBudget - bossHP;

        // Exponential distribution for normal enemies: HPi = a * b^i + offset where b = 1.15
        const b = 1.15;
        const offset = 12; // Base HP

        let a = 0;
        if (numNormalEnemies > 0) {
            // Formula for sum involving base offset: Pool = a * (b^n - 1) / (b - 1) + n * offset
            // Solve for a: a = (Pool - n * offset) * (b - 1) / (Math.pow(b, numNormalEnemies) - 1)
            const denominator = Math.pow(b, numNormalEnemies) - 1;
            if (denominator > 0) {
                a = Math.max(0, (normalHPPool - (numNormalEnemies * offset)) * (b - 1) / denominator);
            }
        }

        const enemyHPs: number[] = [];
        for (let i = 0; i < numNormalEnemies; i++) {
            enemyHPs.push(Math.max(15, Math.ceil(a * Math.pow(b, i) + offset)));
        }
        enemyHPs.push(Math.max(25, bossHP)); // Bosses have a higher floor

        // 4. Generate Monsters
        const generatedMonsterData = [];
        for (let i = 0; i < totalEnemies; i++) {
            const isFinalBoss = i === totalEnemies - 1;
            let pool;
            if (isFinalBoss) {
                pool = MONSTER_TIERS.BOSS;
            } else if (i < totalEnemies / 3) {
                pool = MONSTER_TIERS.WEAK;
            } else if (i < (2 * totalEnemies) / 3) {
                pool = MONSTER_TIERS.MEDIUM;
            } else {
                pool = MONSTER_TIERS.HARD;
            }

            const subPool = Math.random() > 0.5 ? pool.funny : pool.regular;
            const monster = subPool[Math.floor(Math.random() * subPool.length)];
            let resultMonster = { ...monster };

            // Apply custom naming for week 0 if it was the first monster (now index 0)
            if (i === 0 && initialEnemy?.name) {
                resultMonster.name = initialEnemy.name;
                resultMonster.description = initialEnemy.description || resultMonster.description;
            }

            // Prefix final boss name unless already shadow-themed
            if (isFinalBoss && !resultMonster.name.startsWith("The Shadow of")) {
                resultMonster.name = `The Shadow of ${resultMonster.name}`;
            }

            const hp = enemyHPs[i];
            const monsterLevel = isFinalBoss ? W + 1 : Math.min(W, Math.floor(i / (numNormalEnemies / W)) + 1);

            let dropTier = 0;
            // Progressive loot tiers based on HP thresholds
            if (hp < 15) dropTier = 1;
            else if (hp < 40) dropTier = 2;
            else if (hp < 80) dropTier = 3;
            else if (hp < 130) dropTier = 4;
            else if (hp < 200) dropTier = 5;
            else dropTier = 10;

            const isCustom = i === 0 && !!initialEnemy?.name;
            const spell = ENEMY_SPELLS[Math.floor(Math.random() * ENEMY_SPELLS.length)];
            const description = (isCustom || isFinalBoss) ? resultMonster.description : (resultMonster.description + ` Beware its ${spell}!`);

            generatedMonsterData.push({
                name: resultMonster.name,
                description,
                hp: hp,
                maxHp: hp,
                ac: 10,
                level: monsterLevel,
                type: isFinalBoss ? 'BOSS' : 'REGULAR',
                weaponDropTier: isFinalBoss ? Math.max(dropTier, 5) : dropTier, // Bosses drop good stuff
                order: isFinalBoss ? 500 : i,
                isDead: false
            });
        }

        // 5. Prepare Participants
        const participantsData = [];
        for (const pName of participantsNames) {
            if (!pName) continue;
            const cleanName = String(pName).trim();
            if (!cleanName) continue;

            let user = await (prisma.user as any).findFirst({ where: { username: { equals: cleanName } } });
            if (!user) {
                const passwordHash = await bcrypt.hash('password123', 10);
                user = await prisma.user.create({ data: { username: cleanName, passwordHash } });
            }
            participantsData.push({ name: cleanName, userId: user.id });
        }

        // 6. Create Campaign
        const campaign = await prisma.campaign.create({
            data: {
                name,
                config: JSON.stringify({ ...config, totalWeeks, workoutsPerWeek, totalEnemies }),
                currentWeek: 1,
                participants: {
                    create: participantsData.map(p => ({
                        name: p.name,
                        userId: p.userId,
                        level: 1,
                        weaponTier: 0
                    }))
                },
                enemies: {
                    create: generatedMonsterData
                },
                logs: {
                    create: [
                        { type: 'system', content: JSON.stringify({ message: `The Forge is lit for ${name}. The journey begins.` }) },
                        ...(generatedMonsterData.length > 0 ? [{
                            type: 'system',
                            content: JSON.stringify({
                                message: `EVENT_ENEMYNAMED: ${generatedMonsterData[0].name}`,
                                enemyName: generatedMonsterData[0].name,
                                description: generatedMonsterData[0].description
                            })
                        }] : [])
                    ]
                }
            },
            include: {
                participants: true,
                enemies: true,
                logs: true
            }
        });

        res.json(campaign);
    } catch (error: any) {
        console.error('Campaign creation error:', error);
        res.status(500).json({ error: 'Ritual failed.', details: error.message });
    }
};

export const getAllCampaigns = async (req: Request, res: Response) => {
    try {
        const campaigns = await prisma.campaign.findMany({
            select: {
                id: true,
                name: true,
                createdAt: true,
                _count: {
                    select: { participants: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(campaigns);
    } catch (error) {
        console.error('Get campaigns error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const getCampaign = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const campaign = await prisma.campaign.findUnique({
            where: { id },
            include: {
                participants: { orderBy: { id: 'asc' } },
                enemies: {
                    orderBy: { order: 'asc' }
                },
                logs: {
                    orderBy: { timestamp: 'desc' },
                    take: 50
                }
            }
        });

        if (!campaign) {
            res.status(404).json({ error: 'Campaign not found' });
            return;
        }

        res.json(campaign);
    } catch (error) {
        console.error('Get campaign error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};



export const getDefaultCampaign = async (req: Request, res: Response) => {
    try {
        // Just return the first one or error
        const campaign = await prisma.campaign.findFirst({
            include: {
                participants: { orderBy: { id: 'asc' } },
                enemies: { orderBy: { order: 'asc' } },
                logs: { orderBy: { timestamp: 'desc' }, take: 50 }
            }
        });
        if (!campaign) return res.status(404).json({ error: "No campaigns exist. Forge one!" });
        res.json(campaign);
    } catch (e) {
        res.status(500).json({ error: "Error" });
    }
};

export const joinCampaign = async (req: Request, res: Response) => {
    try {
        const { campaignId, userId, characterName } = req.body;

        if (!campaignId || !userId || !characterName) {
            res.status(400).json({ error: 'Missing join parameters' });
            return;
        }

        const existing = await prisma.participant.findFirst({
            where: { campaignId, userId }
        });

        if (existing) {
            res.json(existing);
            return;
        }

        const participant = await prisma.participant.create({
            data: {
                campaignId,
                userId,
                name: characterName,
            }
        });

        await prisma.logEntry.create({
            data: {
                campaignId,
                type: 'system',
                content: JSON.stringify({ message: `${characterName} has joined the fellowship!` })
            }
        });

        res.status(201).json(participant);
    } catch (error) {
        console.error('Join campaign error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const deleteCampaign = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Manual Cascade Delete for SQLite/Postgres without foreign key cascades
        await prisma.$transaction([
            prisma.logEntry.deleteMany({ where: { campaignId: id } }),
            prisma.enemy.deleteMany({ where: { campaignId: id } }),
            prisma.participant.deleteMany({ where: { campaignId: id } }),
            prisma.campaign.delete({ where: { id } })
        ]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete campaign error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const enlistHero = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name) return res.status(400).json({ error: "Name is required" });

        // Check if user exists, else create
        let user = await prisma.user.findUnique({ where: { username: name } });
        if (!user) {
            user = await prisma.user.create({
                data: { username: name, passwordHash: await bcrypt.hash('password123', 10) }
            });
        }

        const participant = await prisma.participant.create({
            data: {
                campaignId: id,
                userId: user.id,
                name: name,
                level: 1,
                weaponTier: 0
            }
        });

        await prisma.logEntry.create({
            data: {
                campaignId: id,
                type: 'system',
                content: JSON.stringify({ message: `${name} has been summoned to the fellowship!` })
            }
        });

        res.status(201).json(participant);
    } catch (error) {
        console.error('Enlist hero error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const forgeAhead = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const campaign = await prisma.campaign.findUnique({
            where: { id },
            include: {
                participants: { orderBy: { id: 'asc' } },
                logs: { orderBy: { timestamp: 'desc' }, take: 10 }
            }
        });

        if (!campaign) return res.status(404).json({ error: "Campaign not found" });

        const config = JSON.parse(campaign.config);
        const oathGoal = config.workoutsPerWeek;
        const totalWeeks = Number(config.totalWeeks || config.weeks || 4);

        // 1. Prepare Summary Data (Before Reset)
        const summary: any = {
            totalMisses: 0,
            totalExtras: 0,
            shadowGrowthHP: 0,
            shadowShrinkHP: 0,
            participants: []
        };

        // Identify loot winners in the current week (from logs)
        const lootWinners = campaign.logs
            .filter(l => l.content.includes('EVENT_LOOT_CLAIMED'))
            .map(l => {
                const data = JSON.parse(l.content);
                return data.winnerName;
            });

        // 2. Process participants
        const participantUpdates: any[] = [];
        const statusLogs: any[] = [];

        campaign.participants.forEach((participant: any) => {
            const p = participant;
            const workouts = p.workoutsThisWeek;
            const hitGoal = workouts >= oathGoal;
            const extraWorkouts = workouts > oathGoal;
            const missedGoal = workouts < oathGoal;

            let statusChange: 'inspired' | 'cursed' | 'saved' | 'sustained' = 'sustained';
            let nextInspired = p.isInspired;
            let nextCursed = p.isCursed;

            if (extraWorkouts) {
                statusChange = 'inspired';
                nextInspired = true;
                nextCursed = false;
            } else if (missedGoal) {
                statusChange = 'cursed';
                nextInspired = false;
                nextCursed = true;
            } else if (hitGoal) {
                if (p.isCursed) {
                    statusChange = 'saved';
                    nextCursed = false;
                } else if (p.isInspired) {
                    statusChange = 'inspired';
                    nextInspired = true;
                } else {
                    statusChange = 'sustained';
                }
            }

            summary.participants.push({
                name: p.name,
                workouts,
                goal: oathGoal,
                statusChange,
                looted: lootWinners.includes(p.name)
            });

            summary.totalMisses += oathGoal; // Total Required
            summary.totalExtras += workouts; // Total Actual

            // Log status changes only if they are transitions (or persistent cursed/inspired)
            // But we already set meaningful text in UI, system logs should capture transitions.
            const transitionMessage = (statusChange === 'saved' && p.isCursed) ? `EVENT_SAVED:${p.name} has been cleansed of their curse.` :
                (statusChange === 'inspired' && !p.isInspired) ? `EVENT_INSPIRED:${p.name} burns with divine inspiration!` :
                    (statusChange === 'cursed' && !p.isCursed) ? `EVENT_CURSED:${p.name} has stumbled.A shadow clings to them.` : '';

            if (transitionMessage) {
                statusLogs.push(prisma.logEntry.create({
                    data: {
                        campaignId: id,
                        type: 'system',
                        content: JSON.stringify({
                            message: transitionMessage,
                            participantName: p.name
                        })
                    }
                }));
            }

            if (hitGoal) {
                statusLogs.push(prisma.logEntry.create({
                    data: {
                        campaignId: id,
                        type: 'system',
                        content: JSON.stringify({
                            message: `EVENT_LEVELUP:${p.name} has reached Level ${p.level + 1} !Their strength grows.`,
                            participantName: p.name,
                            newLevel: p.level + 1
                        })
                    }
                }));
            }

            participantUpdates.push(prisma.participant.update({
                where: { id: p.id },
                data: {
                    level: hitGoal ? p.level + 1 : p.level,
                    workoutsThisWeek: 0,
                    bountyScore: 0,
                    isLootDisqualified: false,
                    isInspired: nextInspired,
                    isCursed: nextCursed,
                } as any
            }));
        });

        const missesPerPlayer: { name: string, count: number }[] = [];
        const extrasPerPlayer: { name: string, count: number }[] = [];

        campaign.participants.forEach(p => {
            if (p.workoutsThisWeek < oathGoal) {
                missesPerPlayer.push({ name: p.name, count: oathGoal - p.workoutsThisWeek });
            } else if (p.workoutsThisWeek > oathGoal) {
                extrasPerPlayer.push({ name: p.name, count: p.workoutsThisWeek - oathGoal });
            }
        });

        // 1. SHADOW LEDGER: IN (Misses)
        if (missesPerPlayer.length > 0) {
            let totalNewShadows = 0;
            for (const miss of missesPerPlayer) {
                for (let i = 0; i < miss.count; i++) {
                    await prisma.enemy.create({
                        data: {
                            campaignId: id,
                            name: `Shadow of ${miss.name}'s Failure`,
                            description: `Spawned in Cycle ${campaign.currentWeek}. Shame! Shame! Shame!`,
                            hp: 15,
                            maxHp: 15,
                            ac: 10,
                            type: "SHADOW",
                            weaponDropTier: 0,
                            order: 10000 + (Date.now() % 100000) + totalNewShadows, // Ledger order
                            isDead: false
                        }
                    });
                    totalNewShadows++;
                }
            }
            summary.shadowMonstersSpawned = totalNewShadows;

            await prisma.logEntry.create({
                data: {
                    campaignId: id,
                    type: 'system',
                    content: JSON.stringify({
                        message: `THE_SHADOW_GROWS: The shadows deepen. ${totalNewShadows} Shadow Monsters have manifested in the background ledger!`
                    })
                }
            });
        }

        // 2. SHADOW LEDGER: OUT (Extras / Banishment)
        if (extrasPerPlayer.length > 0) {
            let totalBanished = 0;
            for (const extra of extrasPerPlayer) {
                let toBanishCount = extra.count;
                while (toBanishCount > 0) {
                    // Try to banish own failure first
                    let target = await prisma.enemy.findFirst({
                        where: {
                            campaignId: id,
                            type: 'SHADOW',
                            name: `Shadow of ${extra.name}'s Failure`,
                            isDead: false
                        },
                        orderBy: { order: 'asc' }
                    });

                    // If no personal shadows, banish oldest shadow
                    if (!target) {
                        target = await prisma.enemy.findFirst({
                            where: {
                                campaignId: id,
                                type: 'SHADOW',
                                isDead: false
                            },
                            orderBy: { order: 'asc' }
                        });
                    }

                    if (target) {
                        await prisma.enemy.delete({ where: { id: target.id } });
                        totalBanished++;
                        toBanishCount--;
                    } else {
                        break; // Ledger empty for this player/campaign
                    }
                }
            }

            if (totalBanished > 0) {
                statusLogs.push(prisma.logEntry.create({
                    data: {
                        campaignId: id,
                        type: 'system',
                        content: JSON.stringify({
                            message: `THE_SHADOW_RECEDES: ${totalBanished} Shadow Monsters have been banished from the ledger by the fellowship's extra effort!`
                        })
                    }
                }));
            }
            summary.shadowMonstersBanished = totalBanished;
        }

        // 4. Update Campaign Week
        const campaignUpdate = prisma.campaign.update({
            where: { id },
            data: {
                currentWeek: campaign.currentWeek + 1,
            }
        });

        // 5. Generate Weekly Summary Log (Shared with all players)
        const summaryLog = prisma.logEntry.create({
            data: {
                campaignId: id,
                type: 'system',
                content: JSON.stringify({
                    message: `EVENT_WEEKLY_SUMMARY:`,
                    ...summary,
                    week: campaign.currentWeek
                })
            }
        });

        await prisma.$transaction([...participantUpdates, ...statusLogs, campaignUpdate, summaryLog]);

        const updatedCampaign = await prisma.campaign.findUnique({
            where: { id },
            include: {
                participants: { orderBy: { id: 'asc' } },
                enemies: { orderBy: { order: 'asc' } },
                logs: { orderBy: { timestamp: 'desc' }, take: 50 }
            }
        });

        res.json({ campaign: updatedCampaign, summary });
    } catch (error) {
        console.error('Forge ahead error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const retireHero = async (req: Request, res: Response) => {
    try {
        const { id, participantId } = req.params;

        const participant = await prisma.participant.findUnique({
            where: { id: participantId }
        });

        if (!participant) return res.status(404).json({ error: "Hero not found" });

        await prisma.participant.delete({
            where: { id: participantId }
        });

        await prisma.logEntry.create({
            data: {
                campaignId: id,
                type: 'system',
                content: JSON.stringify({ message: `${participant.name} has retired from the fellowship.` })
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Retire hero error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
export const renameEnemy = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { order, name, description } = req.body;

        if (order === undefined || !name) {
            return res.status(400).json({ error: "Missing order or name" });
        }

        const enemy = await prisma.enemy.findFirst({
            where: { campaignId: id, order: Number(order) }
        });

        if (!enemy) return res.status(404).json({ error: "Enemy not found" });

        const campaignRecord = await prisma.campaign.findUnique({
            where: { id: enemy.campaignId }
        });
        const config = campaignRecord ? JSON.parse(campaignRecord.config) : {};

        const maxOrderEnemy = await prisma.enemy.findFirst({
            where: { campaignId: id },
            orderBy: { order: 'desc' }
        });
        const isFinalBoss = Number(order) === maxOrderEnemy?.order;

        let finalName = name.trim();
        if (isFinalBoss && !finalName.startsWith("The Shadow of")) {
            finalName = `The Shadow of ${finalName}`;
        }

        const updated = await prisma.enemy.update({
            where: { id: enemy.id },
            data: {
                name: finalName,
                description: (description || "").trim()
            }
        });

        if (updatedCampaign) {
            io.to(id).emit('gamestate_update', updatedCampaign);
        }

        res.json(updated);
    } catch (error) {
        console.error('Rename enemy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const enterShadowRealm = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { bossName, bossDescription } = req.body;

        const campaign = await prisma.campaign.findUnique({
            where: { id },
            include: { enemies: { orderBy: { order: 'asc' } } }
        });

        if (!campaign) return res.status(404).json({ error: "Campaign not found" });

        // 1. Rename the BOSS enemy
        const boss = await prisma.enemy.findFirst({
            where: { campaignId: id, type: 'BOSS' }
        });

        if (boss) {
            let finalBossName = bossName || boss.name;
            if (!finalBossName.startsWith("The Shadow of")) {
                finalBossName = `The Shadow of ${finalBossName}`;
            }

            await prisma.enemy.update({
                where: { id: boss.id },
                data: {
                    name: finalBossName,
                    description: bossDescription || boss.description
                }
            });
        }

        // 2. Sequence all SHADOW enemies from the ledger
        // Find the last REGULAR enemy's order
        const lastRegular = await prisma.enemy.findFirst({
            where: { campaignId: id, type: 'REGULAR' },
            orderBy: { order: 'desc' }
        });

        const startOrder = (lastRegular?.order ?? -1) + 1;

        const shadowMonsters = await prisma.enemy.findMany({
            where: { campaignId: id, type: 'SHADOW' },
            orderBy: { order: 'asc' }
        });

        const updates = shadowMonsters.map((m, index) => {
            return prisma.enemy.update({
                where: { id: m.id },
                data: { order: startOrder + index }
            });
        });

        // Finally, put the boss at the very end
        if (boss) {
            updates.push(prisma.enemy.update({
                where: { id: boss.id },
                data: { order: startOrder + shadowMonsters.length }
            }));
        }

        await prisma.$transaction(updates);

        // Update current enemy index to start the gauntlet if it's not already there
        // (Usually it will be at 'startOrder' after the last regular is defeated)
        // No explicit update needed if UI/handleForgeOnwards handles the increment.

        const updatedCampaign = await prisma.campaign.findUnique({
            where: { id },
            include: {
                participants: { orderBy: { id: 'asc' } },
                enemies: { orderBy: { order: 'asc' } },
                logs: { orderBy: { timestamp: 'desc' }, take: 50 }
            }
        });

        await prisma.logEntry.create({
            data: {
                campaignId: id,
                type: 'system',
                content: JSON.stringify({
                    message: `EVENT_SHADOW_REALM: The fellowship enters the Shadow Realm! ${shadowMonsters.length} Shadows of Failure stand between you and the ${boss?.name || 'Final Shadow'}.`
                })
            }
        });

        const io = getIO();
        if (updatedCampaign) {
            io.to(id).emit('gamestate_update', updatedCampaign);
        }

        res.json({ success: true, campaign: updatedCampaign });
    } catch (error) {
        console.error('Enter shadow realm error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


export const ascendCampaign = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const campaign = await prisma.campaign.findUnique({
            where: { id },
            include: {
                participants: true,
                enemies: { orderBy: { order: 'desc' }, take: 1 }
            }
        });

        if (!campaign) return res.status(404).json({ error: "Campaign not found" });
        if (!campaign.isCompleted) return res.status(400).json({ error: "Only a completed quest may ascend." });

        const config = JSON.parse(campaign.config);
        const workoutsPerWeek = Number(config.workoutsPerWeek || 3);
        const cycleWeeks = Math.max(1, Number(config.totalWeeks || config.weeks || 4));
        const numParticipants = campaign.participants.length;

        // --- ENDLESS HP SCALING MODEL ---
        const startOrder = (campaign.enemies[0]?.order ?? 0) + 1;

        // Use average party power as the baseline
        const avgLevel = campaign.participants.reduce((sum, p) => sum + p.level, 0) / numParticipants;
        const avgWeaponMod = campaign.participants.reduce((sum, p) => sum + calculateAvgWeaponDamage(p.weaponTier), 0) / numParticipants;

        const T = cycleWeeks * workoutsPerWeek;
        const efficiencyFactor = 0.9;
        const difficultyMultiplier = 1.35; // Endless mode is harder
        const instakillBurnFactor = 18 / 20;

        let totalHPBurn = 0;
        for (let t = 0; t < T; t++) {
            const weekInCycle = Math.floor(t / workoutsPerWeek);
            const levelAtAttack = avgLevel + weekInCycle;
            const weaponModAtAttack = avgWeaponMod + Math.floor(weekInCycle / 2);
            const expectedDamage = (10.5 + levelAtAttack + weaponModAtAttack);
            totalHPBurn += expectedDamage * instakillBurnFactor;
        }
        const cycleHPBudget = Math.ceil(totalHPBurn * numParticipants * efficiencyFactor * difficultyMultiplier);

        const expectedInstakills = (numParticipants * T) * (1 / 20);
        let numNormalEnemies = Math.max(cycleWeeks, Math.round(expectedInstakills / 0.2));
        numNormalEnemies = Math.min(numNormalEnemies, cycleWeeks * 4);
        const totalNewEnemies = numNormalEnemies + 1;

        const bossHP = Math.ceil(cycleHPBudget * 0.3);
        const normalHPPool = cycleHPBudget - bossHP;

        const b = 1.25; // Sharper growth
        const offset = avgLevel + 15;

        let a = 0;
        if (numNormalEnemies > 0) {
            const denominator = Math.pow(b, numNormalEnemies) - 1;
            if (denominator > 0) {
                a = Math.max(0, (normalHPPool - (numNormalEnemies * offset)) * (b - 1) / denominator);
            }
        }

        const newEnemies = [];
        for (let i = 0; i < totalNewEnemies; i++) {
            const isBoss = i === totalNewEnemies - 1;
            const hp = isBoss ? Math.max(bossHP, 120) : Math.ceil(a * Math.pow(b, i) + offset);

            const pool = isBoss ? MONSTER_TIERS.BOSS : (i < totalNewEnemies / 2 ? MONSTER_TIERS.MEDIUM : MONSTER_TIERS.HARD);
            const subPool = Math.random() > 0.5 ? pool.funny : pool.regular;
            const monster = subPool[Math.floor(Math.random() * subPool.length)];

            let name = monster.name;
            if (isBoss && !name.startsWith("The Shadow of")) {
                name = `The Shadow of ${name}`;
            }

            const spell = ENEMY_SPELLS[Math.floor(Math.random() * ENEMY_SPELLS.length)];

            newEnemies.push({
                campaignId: id,
                name,
                description: monster.description + (isBoss ? "" : ` Beware its ${spell}!`),
                hp: hp,
                maxHp: hp,
                ac: 10 + Math.floor(avgLevel / 8),
                level: Math.floor(avgLevel + (i / totalNewEnemies) * cycleWeeks) + 1,
                type: isBoss ? 'BOSS' : 'REGULAR',
                weaponDropTier: isBoss ? Math.min(10, Math.floor(avgLevel / 10) + 1) : Math.min(5, Math.floor(avgLevel / 15) + 1),
                order: startOrder + i,
                isDead: false
            });
        }

        await prisma.$transaction([
            prisma.campaign.update({
                where: { id },
                data: {
                    isCompleted: false,
                    isEndless: true,
                    currentWeek: 1,
                    participants: {
                        updateMany: {
                            where: { campaignId: id },
                            data: { optedInToEndless: false }
                        }
                    }
                }
            }),
            prisma.enemy.createMany({ data: newEnemies }),
            prisma.logEntry.create({
                data: {
                    campaignId: id,
                    type: 'system',
                    content: JSON.stringify({ message: "EVENT_ASCENSION: The Fellowship has ascended to Endless Mode! The light of the Forge burns through the deepening gloom." })
                }
            })
        ]);

        const updated = await prisma.campaign.findUnique({
            where: { id },
            include: {
                participants: { orderBy: { id: 'asc' } },
                enemies: { orderBy: { order: 'asc' } },
                logs: { orderBy: { timestamp: 'desc' }, take: 50 }
            }
        });

        const io = getIO();
        if (updated) io.to(id).emit('gamestate_update', updated);

        res.json(updated);
    } catch (error) {
        console.error('Ascend error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const optInToEndless = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { participantId } = req.body;

        if (!participantId) return res.status(400).json({ error: "Participant ID required" });

        // Update participant opt-in status
        await prisma.participant.update({
            where: { id: participantId },
            data: { optedInToEndless: true }
        });

        // Check if everyone has opted in
        const allParticipants = await prisma.participant.findMany({
            where: { campaignId: id }
        });

        const allOptedIn = allParticipants.every(p => p.optedInToEndless);

        // If all opted in, activate Endless Mode (isolated from main campaign)
        if (allOptedIn) {
            try {
                // ENDLESS MODE ACTIVATION - COMPLETELY ISOLATED
                const campaign = await prisma.campaign.findUnique({
                    where: { id },
                    include: {
                        participants: true,
                        enemies: { orderBy: { order: 'desc' }, take: 1 }
                    }
                });

                if (!campaign) return res.status(404).json({ error: "Campaign not found" });

                const config = JSON.parse(campaign.config);
                const workoutsPerWeek = Number(config.workoutsPerWeek || 3);
                const cycleWeeks = Math.max(1, Number(config.totalWeeks || config.weeks || 4));
                const numParticipants = campaign.participants.length;

                // Calculate starting order for new endless enemies
                const startOrder = (campaign.enemies[0]?.order ?? 0) + 1;

                // Use average party power as baseline
                const avgLevel = campaign.participants.reduce((sum, p) => sum + p.level, 0) / numParticipants;
                const avgWeaponMod = campaign.participants.reduce((sum, p) => sum + calculateAvgWeaponDamage(p.weaponTier), 0) / numParticipants;

                // Endless mode scaling parameters
                const T = numParticipants * workoutsPerWeek * cycleWeeks;
                const difficultyMultiplier = 1.5; // Endless mode is harder
                const efficiencyFactor = 0.65;
                const instakillBurnFactor = 0.25;

                let totalHPBurn = 0;
                for (let t = 0; t < T; t++) {
                    const weekInCycle = Math.floor(t / workoutsPerWeek);
                    const levelAtAttack = avgLevel + weekInCycle;
                    const weaponModAtAttack = avgWeaponMod + Math.floor(weekInCycle / 2);
                    const expectedDamage = (10.5 + levelAtAttack + weaponModAtAttack);
                    totalHPBurn += expectedDamage * instakillBurnFactor;
                }
                const cycleHPBudget = Math.ceil(totalHPBurn * numParticipants * efficiencyFactor * difficultyMultiplier);

                const expectedInstakills = (numParticipants * T) * (1 / 20);
                let numNormalEnemies = Math.max(cycleWeeks, Math.round(expectedInstakills / 0.2));
                numNormalEnemies = Math.min(numNormalEnemies, cycleWeeks * 4);
                const totalNewEnemies = numNormalEnemies + 1;

                const bossHP = Math.ceil(cycleHPBudget * 0.3);
                const normalHPPool = cycleHPBudget - bossHP;

                const b = 1.25;
                const offset = avgLevel + 15;

                let a = 0;
                if (numNormalEnemies > 0) {
                    const denominator = Math.pow(b, numNormalEnemies) - 1;
                    if (denominator > 0) {
                        a = Math.max(0, (normalHPPool - (numNormalEnemies * offset)) * (b - 1) / denominator);
                    }
                }

                const newEnemies = [];
                for (let i = 0; i < totalNewEnemies; i++) {
                    const isBoss = i === totalNewEnemies - 1;
                    const hp = isBoss ? Math.max(bossHP, 120) : Math.ceil(a * Math.pow(b, i) + offset);

                    const pool = isBoss ? MONSTER_TIERS.BOSS : (i < totalNewEnemies / 2 ? MONSTER_TIERS.MEDIUM : MONSTER_TIERS.HARD);
                    const subPool = Math.random() > 0.5 ? pool.funny : pool.regular;
                    const monster = subPool[Math.floor(Math.random() * subPool.length)];

                    let name = monster.name;
                    if (isBoss && !name.startsWith("The Shadow of")) {
                        name = `The Shadow of ${name}`;
                    }

                    const spell = ENEMY_SPELLS[Math.floor(Math.random() * ENEMY_SPELLS.length)];

                    newEnemies.push({
                        campaignId: id,
                        name,
                        description: monster.description + (isBoss ? "" : ` Beware its ${spell}!`),
                        hp: hp,
                        maxHp: hp,
                        ac: 10 + Math.floor(avgLevel / 8),
                        level: Math.floor(avgLevel + (i / totalNewEnemies) * cycleWeeks) + 1,
                        type: isBoss ? 'BOSS' : 'REGULAR',
                        weaponDropTier: isBoss ? Math.min(10, Math.floor(avgLevel / 10) + 1) : Math.min(5, Math.floor(avgLevel / 15) + 1),
                        order: startOrder + i,
                        isDead: false
                    });
                }

                // Update campaign and create new enemies in transaction
                await prisma.$transaction([
                    prisma.campaign.update({
                        where: { id },
                        data: {
                            isCompleted: false,
                            isEndless: true,
                            currentWeek: 1,
                            participants: {
                                updateMany: {
                                    where: { campaignId: id },
                                    data: { optedInToEndless: false }
                                }
                            }
                        }
                    }),
                    prisma.enemy.createMany({ data: newEnemies }),
                    prisma.logEntry.create({
                        data: {
                            campaignId: id,
                            type: 'system',
                            content: JSON.stringify({ message: "EVENT_ASCENSION: The Fellowship has ascended to Endless Mode! The light of the Forge burns through the deepening gloom." })
                        }
                    })
                ]);

                const updated = await prisma.campaign.findUnique({
                    where: { id },
                    include: {
                        participants: { orderBy: { id: 'asc' } },
                        enemies: { orderBy: { order: 'asc' } },
                        logs: { orderBy: { timestamp: 'desc' }, take: 50 }
                    }
                });

                const io = getIO();
                if (updated) io.to(id).emit('gamestate_update', updated);

                return res.json(updated);
            } catch (endlessError) {
                // Endless mode error - should NOT affect main campaign
                console.error('Endless mode activation error:', endlessError);
                return res.status(500).json({ error: 'Failed to activate Endless Mode. Main campaign unaffected.' });
            }
        }

        // Return updated campaign state (not yet in endless mode)
        const updated = await prisma.campaign.findUnique({
            where: { id },
            include: {
                participants: { orderBy: { id: 'asc' } },
                enemies: { orderBy: { order: 'asc' } },
                logs: { orderBy: { timestamp: 'desc' }, take: 50 }
            }
        });

        const io = getIO();
        if (updated) io.to(id).emit('gamestate_update', updated);

        res.json(updated);
    } catch (error) {
        console.error('Opt-in error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
