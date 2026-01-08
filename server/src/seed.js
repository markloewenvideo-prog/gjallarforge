const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Prisma 7: Datasource is configured in prisma.config.ts, not here
const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    try {
        // Users
        const passwordHash = await bcrypt.hash('password123', 10);
        const users = ['Krag', 'DM', 'Velkyn'];
        const createdUsers = [];

        for (const u of users) {
            const user = await prisma.user.upsert({
                where: { username: u },
                update: {},
                create: { username: u, passwordHash },
            });
            createdUsers.push(user);
            console.log(`Created user: ${u}`);
        }

        // Campaign
        const campaignName = "The Iron Crusade (Test)";
        const config = { totalWeeks: 4, workoutsPerWeek: 3, numParticipants: 3 };

        const existing = await prisma.campaign.findFirst({
            where: { name: campaignName }
        });

        if (!existing) {
            const enemies = Array.from({ length: 4 }).map((_, i) => ({
                name: `Void Titan ${i + 1}`,
                description: "A test enemy for checking the UI.",
                maxHp: 100 + (i * 20),
                hp: 100 + (i * 20),
                ac: 12 + i,
                weaponDropTier: i,
                order: i,
                isDead: false
            }));

            const campaign = await prisma.campaign.create({
                data: {
                    name: campaignName,
                    config: JSON.stringify(config),
                    participants: {
                        create: createdUsers.map(u => ({
                            name: u.username,
                            userId: u.id
                        }))
                    },
                    enemies: {
                        create: enemies
                    },
                    logs: {
                        create: [{
                            type: 'system',
                            content: JSON.stringify({ message: 'The seed campaign has begun.' }),
                            timestamp: new Date()
                        }]
                    }
                }
            });
            console.log(`Created campaign: ${campaign.name}`);
        } else {
            console.log("Campaign already exists.");
        }

    } catch (e) {
        console.error("Seed error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
