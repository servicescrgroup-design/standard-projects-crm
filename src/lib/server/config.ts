import "server-only";

/** False until the database connection variables are set (e.g. a fresh Vercel project). */
export function isDbConfigured(): boolean {
  return !!process.env.POSTGRES_PRISMA_URL && !!process.env.POSTGRES_URL_NON_POOLING;
}
