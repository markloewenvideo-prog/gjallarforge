import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

console.log('[DEBUG] DB Code Loading. URL is present:', !!process.env.DATABASE_URL);
export const prisma = new PrismaClient();
