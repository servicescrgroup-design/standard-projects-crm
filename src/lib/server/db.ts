import { PrismaClient } from "@prisma/client";
import { countryOfLead } from "../countries";

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

type Fields = { location?: unknown; industry?: unknown; phone?: unknown; company?: unknown; country?: unknown };
const FIELDS = ["location", "industry", "phone", "company"] as const;
const text = (v: unknown) => (typeof v === "string" ? v : null);
/** Prisma accepts `{ set: value }` as well as a plain value in update data. */
const plain = (v: unknown) => (v && typeof v === "object" && "set" in v ? (v as { set: unknown }).set : v);
const codeOf = (f: Fields) =>
  countryOfLead({ location: text(f.location), industry: text(f.industry), phone: text(f.phone), company: text(f.company) })?.code ?? null;

/**
 * Lead.country is a stored copy of countryOfLead(), which territory access (src/lib/access.ts) filters on in
 * the database. It is recomputed on every lead write so it can't drift from the flags shown in the app.
 */
function makeClient() {
  const base = new PrismaClient({ datasourceUrl: pooledUrl() });
  return base.$extends({
    query: {
      lead: {
        create({ args, query }) {
          const d = args.data as Fields;
          return query({ ...args, data: ("country" in d ? d : { ...d, country: codeOf(d) }) as typeof args.data });
        },
        createMany({ args, query }) {
          const fill = (d: Fields) => ("country" in d ? d : { ...d, country: codeOf(d) });
          const data = Array.isArray(args.data) ? args.data.map((d) => fill(d as Fields)) : fill(args.data as Fields);
          return query({ ...args, data: data as typeof args.data });
        },
        async update({ args, query }) {
          const d = args.data as Fields;
          if ("country" in d || !FIELDS.some((f) => f in d)) return query(args);
          // Only some fields were sent: combine them with what's stored so the country sees all four.
          const stored = await base.lead.findUnique({ where: args.where, select: { location: true, industry: true, phone: true, company: true } });
          const merged: Fields = { ...stored };
          for (const f of FIELDS) if (f in d) merged[f] = plain(d[f]);
          return query({ ...args, data: { ...args.data, country: codeOf(merged) } });
        },
      },
    },
  });
}

type Db = ReturnType<typeof makeClient>;
const globalForPrisma = globalThis as unknown as { prisma?: Db };

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
