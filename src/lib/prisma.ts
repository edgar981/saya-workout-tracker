import { PrismaClient } from "@prisma/client";

/**
 * Singleton de Prisma. En dev, el hot-reload de Next reevalúa los módulos y sin
 * este guard se abriría una conexión nueva por recarga hasta agotar el pool.
 * Solo lo usan las rutas de /api (Node runtime); nunca el cliente.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
