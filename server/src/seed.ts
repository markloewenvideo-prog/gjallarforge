import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

// Load .env explicitly
dotenv.config({ path: path.join(__dirname, '../.env') });

// Force fallback if missing
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = "file:./dev.db";
}

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');
    console.log('Database URL:', process.env.DATABASE_URL);

    // Create Users
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

    // Create Campaign
    const campaignName = "The Iron Crusade (Test)";
    const config = { totalWeeks: 4, workoutsPerWeek: 3, numParticipants: 3 };

    // Check if campaign already exists
    const existing = await prisma.campaign.findFirst({
        where: { name: campaignName }
    });

    if (!existing) {
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
                    create: Array.from({ length: 4 }).map((_, i) => ({
                        name: `Void Titan ${i + 1}`,
                        description: "A test enemy for checking the UI.",
                        maxHp: 100 + (i * 20),
                        hp: 100 + (i * 20),
                        ac: 12 + i,
                        weaponDropTier: i,
                        order: i,
                        isDead: false
                    }))
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
        console.log("Campaign already exists. Skipping.");
    }
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
