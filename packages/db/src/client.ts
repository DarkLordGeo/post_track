import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { __postTrackerPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.__postTrackerPrisma ?? new PrismaClient({ log: ['warn', 'error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.__postTrackerPrisma = prisma;
