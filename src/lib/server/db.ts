import { PrismaClient } from "@prisma/client";

/**
 * Pages run several queries in parallel. Supabase's transaction pooler is fine with a few
 * connections per serverless instance, so allow 5 (the usual connection_limit=1 queues them,
 * and slow round trips then hit the 10s pool timeout).
 */
function pooledUrl(): string | undefined {
  const raw = process.env.POSTGRES_PRISMA_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (Number(url.searchParams.get("connection_limit") ?? 0) < 5) url.searchParams.set("connection_limit", "5");
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20");
    return url.toString();
  } catch {
    return raw;
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: pooledUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
