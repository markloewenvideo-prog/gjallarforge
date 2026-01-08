import { Request, Response } from 'express';
import { prisma } from '../db';
import { MONSTER_TIERS } from '../data/enemies';
import { ENEMY_SPELLS } from '../data/content';
import { calculateAvgWeaponDamage, getWeaponDropTier } from '../constants';
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
        const { name: rawName, config: rawConfig, participantsNames } = req.body;

        // Handle config being passed as a string (from our API service)
        const config = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
        const name = (rawName || "The Gjallar Forge").trim();

        if (!config || !participantsNames || !Array.isArray(participantsNames)) {
            return res.status(400).json({ error: "Missing required fields or invalid participants list" });
        }

        console.log("[DEBUG] Starting createCampaign for:", name);

        // 1. Local Enemy Generation (Instant)
        console.log("[DEBUG] Generating enemies locally...");
        const totalWeeks = Number(config.totalWeeks || config.weeks || 4);
        const workoutsPerWeek = Number(config.workoutsPerWeek || 3);

        const generatedMonsterData = Array.from({ length: totalWeeks }, (_, i) => {
            const isFinalBoss = i === totalWeeks - 1;
            let tier: string;

            if (isFinalBoss) {
                tier = 'T6';
            } else {
                // Map progress (0 to 1) across T1 to T5
                const progress = i / Math.max(1, totalWeeks - 1);
                if (progress < 0.2) tier = 'T1';
                else if (progress < 0.4) tier = 'T2';
                else if (progress < 0.6) tier = 'T3';
                else if (progress < 0.8) tier = 'T4';
                else tier = 'T5';
            }

            const pool = MONSTER_TIERS[tier];
            const useFunny = Math.random() > 0.5;
            const subPool = useFunny ? pool.funny : pool.regular;

            return subPool[Math.floor(Math.random() * subPool.length)];
        });
        console.log("[DEBUG] Generation complete. Count:", generatedMonsterData.length);

        // 2. Prepare Participants (Ensuring Users exist for foreign key)
        const participantsData = [];
        for (const pName of participantsNames) {
            const cleanName = pName.trim();
            if (!cleanName) continue;

            let user = await prisma.user.findUnique({ where: { username: cleanName } });
            if (!user) {
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

        // 3. Create Campaign and related entities
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
                        const dropTier = getWeaponDropTier(i, totalWeeks);
                        const avgDmg = calculateAvgWeaponDamage(dropTier);

                        // Expected Level for this week
                        const expectedLevel = 1 + i;

                        // Total workouts for the whole campaign:
                        const totalCampaignWorkouts = participantsData.length * workoutsPerWeek * totalWeeks;

                        // Boss takes a huge chunk (40%), others split the remaining 60%
                        const isBoss = i === totalWeeks - 1;
                        const budgetPercentage = isBoss ? 0.40 : (0.60 / Math.max(1, totalWeeks - 1));

                        const budgetedWorkoutsForThisEnemy = totalCampaignWorkouts * budgetPercentage;

                        // Target AC: ExpectedLevel + 8 (Hit chance: ~65% with +Strength bonus)
                        // Add variance of -1, 0, or +1
                        const variance = Math.floor(Math.random() * 3) - 1;
                        const ac = expectedLevel + 8 + variance;

                        // HP = Budgeted Workouts * (Avg Weapon Damage + Expected Level Strength Bonus) * Scale
                        // 0.70 factor offsets critical hits and better-than-average rolls
                        const hp = Math.ceil(budgetedWorkoutsForThisEnemy * (avgDmg + expectedLevel) * 0.70);

                        const spell = ENEMY_SPELLS[Math.floor(Math.random() * ENEMY_SPELLS.length)];
                        const finalDescription = `${data.description} Beware its ${spell}!`;

                        return {
                            name: data.name,
                            description: finalDescription,
                            hp: Math.max(10, hp),
                            maxHp: Math.max(10, hp),
                            ac: ac,
                            weaponDropTier: dropTier,
                            order: i,
                            isDead: false
                        };
                    })
                },
                logs: {
                    create: {
                        type: 'system',
                        content: JSON.stringify({ message: `The Forge is lit for ${name}. The journey begins.` })
                    }
                }
            },
            include: {
                participants: true,
                enemies: true,
                logs: true
            }
        });

        res.json(campaign);
    } catch (error) {
        console.error('Campaign creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
                participants: true,
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
            include: { participants: true, enemies: { orderBy: { order: 'asc' } }, logs: { orderBy: { timestamp: 'desc' }, take: 50 } }
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

        // Manual Cascade Delete for SQLite without foreign key cascades
        await prisma.logEntry.deleteMany({ where: { campaignId: id } });
        await prisma.enemy.deleteMany({ where: { campaignId: id } });
        await prisma.participant.deleteMany({ where: { campaignId: id } });
        await prisma.campaign.delete({ where: { id } });

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
            include: { participants: true }
        });

        if (!campaign) return res.status(404).json({ error: "Campaign not found" });

        const config = JSON.parse(campaign.config);
        const oathGoal = config.workoutsPerWeek;

        // Process participants
        const updates = campaign.participants.map(p => {
            const leveledUp = p.workoutsThisWeek >= oathGoal;
            return prisma.participant.update({
                where: { id: p.id },
                data: {
                    level: leveledUp ? p.level + 1 : p.level,
                    workoutsThisWeek: 0,
                    isLootDisqualified: false,
                    isInspired: false,
                } as any
            });
        });

        // Update campaign week
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

        await prisma.$transaction([...updates, campaignUpdate]);

        const updatedCampaign = await prisma.campaign.findUnique({
            where: { id },
            include: { participants: true, enemies: true, logs: { orderBy: { timestamp: 'desc' }, take: 50 } }
        });

        res.json(updatedCampaign);
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
