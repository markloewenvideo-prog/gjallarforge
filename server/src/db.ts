import { PrismaClient } from '@prisma/client';

// Prisma 7: Datasource is configured in prisma.config.ts, not here
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
