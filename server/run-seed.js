const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const users = ['Krag', 'DM', 'Velkyn'];

    for (const username of users) {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (!existing) {
            const passwordHash = await bcrypt.hash('password123', 10);
            await prisma.user.create({
                data: {
                    username,
                    passwordHash
                }
            });
            console.log(`Created user: ${username}`);
        } else {
            console.log(`User already exists: ${username}`);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
