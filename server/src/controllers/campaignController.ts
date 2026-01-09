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
    console.log("[DEBUG] Request-time DATABASE_URL:", process.env.DATABASE_URL);
    try {
        const { name: rawName, config: rawConfig, participantsNames, initialEnemy } = req.body;

        // Handle config being passed as a string (from our API service)
        const config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;

        // Handle naming convention: Forge 1, Forge 2...
        let name = (rawName || "").trim();
        if (!name) {
            const count = await prisma.campaign.count();
            name = `Forge ${count + 1}`;
        }

        if (!config || !participantsNames || !Array.isArray(participantsNames)) {
            return res.status(400).json({ error: "Missing required fields or invalid participants list" });
        }

        console.log("[DEBUG] Starting createCampaign for:", name);

        // 1. Local Enemy Generation
        console.log("[DEBUG] Step 1: Generating enemies...");
        let generatedMonsterData: any[];
        try {
            const totalWeeks = Math.max(1, Number(config.totalWeeks || config.weeks || 4));
            generatedMonsterData = [];

            for (let week = 0; week < totalWeeks; week++) {
                const isFinalWeek = week === totalWeeks - 1;

                // 1. Weak Monster
                const weakPool = MONSTER_TIERS.WEAK;
                const weakMonster = (Math.random() > 0.5 ? weakPool.funny : weakPool.regular)[Math.floor(Math.random() * weakPool.regular.length)];
                generatedMonsterData.push({ ...weakMonster, type: 'WEAK', week });

                // 2. Medium Monster
                const medPool = MONSTER_TIERS.MEDIUM;
                const medMonster = (Math.random() > 0.5 ? medPool.funny : medPool.regular)[Math.floor(Math.random() * medPool.regular.length)];
                generatedMonsterData.push({ ...medMonster, type: 'MEDIUM', week });

                // 3. Hard Monster (or Boss)
                let hardPool = isFinalWeek ? MONSTER_TIERS.BOSS : MONSTER_TIERS.HARD;
                const hardMonster = (Math.random() > 0.5 ? hardPool.funny : hardPool.regular)[Math.floor(Math.random() * hardPool.regular.length)];

                let finalHard = { ...hardMonster, type: 'HARD', week };

                // Override for the first week's Hard monster if provided
                if (week === 0 && initialEnemy && typeof initialEnemy === 'object') {
                    finalHard.name = initialEnemy.name || finalHard.name;
                    finalHard.description = initialEnemy.description || finalHard.description;
                }

                // If final week, add "The Shadow of" prefix if not there
                if (isFinalWeek && !finalHard.name.startsWith("The Shadow of")) {
                    finalHard.name = `The Shadow of ${finalHard.name}`;
                }

                generatedMonsterData.push(finalHard);
            }
            console.log("[DEBUG] Generation complete. Count:", generatedMonsterData.length);
        } catch (e: any) {
            console.error("[DEBUG] Step 1 Failed:", e);
            throw new Error(`Enemy Generation Failed: ${e.message}`);
        }

        // 2. Prepare Participants
        console.log("[DEBUG] Step 2: Preparing participants...");
        const participantsData = [];
        try {
            console.log("[DEBUG] participantsNames type:", typeof participantsNames, "isArray:", Array.isArray(participantsNames));
            console.log("[DEBUG] participantsNames content:", JSON.stringify(participantsNames));

            if (!prisma.user) {
                console.error("[DEBUG] CRITICAL: prisma.user is missing!", Object.keys(prisma));
                throw new Error("The Fellowship Hall (User table) is not correctly initialized in the Forge. Contact Krag.");
            }

            for (const pName of participantsNames) {
                console.log("[DEBUG] Processing pName:", typeof pName, pName);
                if (pName === null || pName === undefined) continue;

                const cleanName = String(pName).trim();
                if (!cleanName || cleanName === "null" || cleanName === "undefined") continue;

                console.log("[DEBUG] Searching for user:", cleanName);
                let user = await (prisma.user as any).findFirst({
                    where: {
                        username: {
                            equals: cleanName
                        }
                    }
                });

                if (!user) {
                    console.log("[DEBUG] Creating new user for:", cleanName);
                    const passwordHash = await bcrypt.hash('password123', 10);
                    user = await prisma.user.create({
                        data: { username: cleanName, passwordHash }
                    });
                }
                participantsData.push({
                    name: cleanName,
                    userId: user.id
                });
            }
            console.log("[DEBUG] Participants ready:", participantsData.length);
        } catch (e: any) {
            console.error("[DEBUG] Step 2 Failed:", e);
            throw new Error(`Hero Selection Failed: ${e.message}`);
        }

        // 3. Create Campaign and related entities
        console.log("[DEBUG] Step 3: Executing Database Transaction...");
        try {
            const workoutsPerWeek = Number(config.workoutsPerWeek || 3);
            const totalWeeks = Math.max(1, Number(config.totalWeeks || config.weeks || 4));

            const campaign = await prisma.campaign.create({
                data: {
                    name,
                    config: JSON.stringify({ ...config, totalWeeks, workoutsPerWeek }),
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
                        create: generatedMonsterData.map((data: any, i: number) => {
                            const weekIndex = Math.floor(i / 3);
                            const typeInWeek = i % 3; // 0=Weak, 1=Medium, 2=Hard

                            // Weapon drops only on Hard monsters (the 3rd of the week)
                            const dropTier = typeInWeek === 2 ? getWeaponDropTier(weekIndex, totalWeeks) : 0;

                            // Weekly damage expectation
                            const expectedLevel = 1 + weekIndex;
                            const totalCampaignWorkouts = participantsData.length * workoutsPerWeek * totalWeeks;

                            const isFinalBoss = i === (totalWeeks * 3) - 1;

                            // HP BUDGETING
                            // Let's reserve 30% for the Final Boss.
                            // Split remaining across weeks, then within weeks: 15/30/55
                            const finalBossBudget = 0.30;
                            const remainingBudget = 1.0 - finalBossBudget;
                            const weeklyBudget = remainingBudget / totalWeeks;

                            let enemyBudget;
                            if (isFinalBoss) {
                                enemyBudget = finalBossBudget;
                            } else {
                                const weekWeights = [0.15, 0.30, 0.55];
                                enemyBudget = weeklyBudget * weekWeights[typeInWeek];
                            }

                            const budgetedWorkouts = totalCampaignWorkouts * enemyBudget;

                            // Damage scaling
                            // Use previous week's weapon for current expected damage
                            const prevWeaponTier = weekIndex === 0 ? 0 : getWeaponDropTier(weekIndex - 1, totalWeeks);
                            const currentWeaponBonus = calculateAvgWeaponDamage(prevWeaponTier);
                            const avgDamagePerHit = 10.5 + expectedLevel + currentWeaponBonus;

                            const toughness = isFinalBoss ? 1.5 : (typeInWeek === 2 ? 1.1 : 0.9);
                            const hp = Math.ceil(budgetedWorkouts * avgDamagePerHit * toughness);

                            const spell = ENEMY_SPELLS[Math.floor(Math.random() * ENEMY_SPELLS.length)];
                            const finalDescription = (i === 2 && weekIndex === 0 && initialEnemy)
                                ? data.description
                                : `${data.description} Beware its ${spell}!`;

                            return {
                                name: data.name,
                                description: finalDescription,
                                hp: Math.max(10, hp),
                                maxHp: Math.max(10, hp),
                                ac: 10,
                                weaponDropTier: dropTier,
                                order: i,
                                isDead: false
                            };
                        })
                    },
                    logs: {
                        create: [
                            {
                                type: 'system',
                                content: JSON.stringify({ message: `The Forge is lit for ${name}. The journey begins.` })
                            },
                            ...(generatedMonsterData.length > 0 ? [{
                                type: 'system',
                                content: JSON.stringify({
                                    message: `EVENT_ENEMYNAMED:${generatedMonsterData[0].name}`,
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

            console.log("[DEBUG] Campaign Created Successfully:", campaign.id);
            res.json(campaign);
        } catch (e: any) {
            console.error("[DEBUG] Step 3 Failed:", e);
            throw new Error(`Database Transaction Failed: ${e.message}`);
        }
    } catch (error: any) {
        console.error('Campaign creation error:', error);
        res.status(500).json({
            error: 'Ritual failed. The Forge rejected your request.',
            details: error.message || String(error)
        });
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
                    (statusChange === 'cursed' && !p.isCursed) ? `EVENT_CURSED:${p.name} has stumbled. A shadow clings to them.` : '';

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
                            message: `EVENT_LEVELUP:${p.name} has reached Level ${p.level + 1}! Their strength grows.`,
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

        // 3. Shadow Growth (Missed Oaths spawn monsters) & Shrink Logic (Collective)
        const netMisses = summary.totalMisses - summary.totalExtras; // (Sum Goals) - (Sum Actual)

        if (netMisses > 0) {
            // SHADOW GROWTH: Spawn monsters
            summary.shadowMonstersSpawned = netMisses;

            const shadowPool = MONSTER_TIERS.SHADOW;
            const finalBoss = await prisma.enemy.findFirst({
                where: { campaignId: id, order: (totalWeeks * 3) + 1000 }, // Dummy high but we'll find the max
                orderBy: { order: 'desc' }
            }) || await prisma.enemy.findFirst({
                where: { campaignId: id },
                orderBy: { order: 'desc' }
            });

            if (finalBoss) {
                const bossOrder = finalBoss.order;

                // Shift boss order up by netMisses
                await prisma.enemy.update({
                    where: { id: finalBoss.id },
                    data: { order: bossOrder + netMisses }
                });

                // Create new shadow monsters in the gap
                for (let i = 0; i < netMisses; i++) {
                    const data = (Math.random() > 0.5 ? shadowPool.funny : shadowPool.regular)[Math.floor(Math.random() * shadowPool.regular.length)];

                    await prisma.enemy.create({
                        data: {
                            campaignId: id,
                            name: data.name,
                            description: data.description,
                            hp: 50 + (campaign.currentWeek * 10), // Scaling weak HP
                            maxHp: 50 + (campaign.currentWeek * 10),
                            ac: 10,
                            weaponDropTier: 0,
                            order: bossOrder + i,
                            isDead: false
                        }
                    });
                }

                await prisma.logEntry.create({
                    data: {
                        campaignId: id,
                        type: 'system',
                        content: JSON.stringify({
                            message: `SHADOW_GROWTH: ${netMisses} Shadow Monsters have manifested from your missed Oaths! They stand between you and the final shadow.`
                        })
                    }
                });
            }
        } else if (netMisses < 0) {
            // SHADOW SHRINK: Still affects final boss HP
            const penaltyPerWorkout = 15 + totalWeeks;
            const hpAdjustment = netMisses * penaltyPerWorkout; // Negative
            summary.shadowShrinkHP = Math.abs(hpAdjustment);

            const finalBoss = await prisma.enemy.findFirst({
                where: { campaignId: id },
                orderBy: { order: 'desc' }
            });

            if (finalBoss && !finalBoss.isDead) {
                const newHP = Math.max(1, finalBoss.hp + hpAdjustment);
                const newMaxHP = Math.max(1, finalBoss.maxHp + hpAdjustment);

                await prisma.enemy.update({
                    where: { id: finalBoss.id },
                    data: {
                        hp: newHP,
                        maxHp: newMaxHP,
                        adjustmentHp: { increment: hpAdjustment }
                    } as any
                });

                await prisma.logEntry.create({
                    data: {
                        campaignId: id,
                        type: 'system',
                        content: JSON.stringify({
                            message: `SHADOW_RECEDES: The fellowship's zeal burns the darkness, stripping ${Math.abs(hpAdjustment)} HP from the final foe.`
                        })
                    }
                });
            }
        }

        // 4. Update Campaign Week
        const campaignUpdate = prisma.campaign.update({
            where: { id },
            data: {
                currentWeek: campaign.currentWeek + 1,
                logs: {
                    create: {
                        type: 'system',
                        content: JSON.stringify({ message: `Cycle ${campaign.currentWeek + 1} has begun. The Forge burns brighter.` })
                    }
                }
            }
        });

        await prisma.$transaction([...participantUpdates, ...statusLogs, campaignUpdate]);

        const updatedCampaign = await prisma.campaign.findUnique({
            where: { id },
            include: {
                participants: { orderBy: { id: 'asc' } },
                enemies: true,
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
        const totalWeeks = Number(config.totalWeeks || config.weeks || 4);
        const isFinalBoss = Number(order) === totalWeeks - 1;

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

        await prisma.logEntry.create({
            data: {
                campaignId: id,
                type: 'system',
                content: JSON.stringify({
                    message: `EVENT_ENEMYNAMED:${updated.name}`,
                    enemyName: updated.name,
                    description: updated.description
                })
            }
        });

        const io = getIO();
        const updatedCampaign = await prisma.campaign.findUnique({
            where: { id },
            include: {
                participants: { orderBy: { id: 'asc' } },
                enemies: { orderBy: { order: 'asc' } },
                logs: { orderBy: { timestamp: 'desc' }, take: 50 }
            }
        });

        if (updatedCampaign) {
            io.to(id).emit('gamestate_update', updatedCampaign);
        }

        res.json(updatedCampaign);
    } catch (error) {
        console.error('Rename enemy error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
