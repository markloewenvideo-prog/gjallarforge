import { PrismaClient } from '@prisma/client';

// Prisma 7: Datasource is configured in prisma.config.ts, not here
// Export a new instance directly to avoid global pollution issues
export const prisma = new PrismaClient();
