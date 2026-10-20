/** Customer acquisition cost from real spend records and real won customers. */

export type SpendRow = { source: string; month: string; amount: number }; // amount in minor units
export type WonCustomer = { source: string; wonAt: Date };

export type ChannelCAC = {
  source: string;
  spend: number;
  customers: number;
  share: number; // % of new customers in the window
  cac: number | null; // spend per customer, null when there were no customers
  mostEffective: boolean;
};

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The last `months` calendar months including the current one, oldest first. */
export function recentMonths(now: Date, months: number): string[] {
  return Array.from({ length: months }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)));
}

export function computeCAC(spends: SpendRow[], won: WonCustomer[], now: Date, months = 3) {
  const window = new Set(recentMonths(now, months));
  const spendBy = new Map<string, number>();
  for (const s of spends) if (window.has(s.month)) spendBy.set(s.source, (spendBy.get(s.source) ?? 0) + s.amount);
  const custBy = new Map<string, number>();
  const inWindow = won.filter((w) => window.has(monthKey(w.wonAt)));
  for (const w of inWindow) custBy.set(w.source, (custBy.get(w.source) ?? 0) + 1);

  const sources = [...new Set([...spendBy.keys(), ...custBy.keys()])];
  const total = inWindow.length;
  const channels: ChannelCAC[] = sources.map((source) => {
    const spend = spendBy.get(source) ?? 0;
    const customers = custBy.get(source) ?? 0;
    return { source, spend, customers, share: total ? Math.round((customers / total) * 100) : 0, cac: customers ? Math.round(spend / customers) : null, mostEffective: false };
  });
  // Most effective = lowest cost per customer among channels with spend recorded and customers won.
  const ranked = channels.filter((c) => c.cac !== null && c.spend > 0).sort((a, b) => a.cac! - b.cac!);
  if (ranked.length > 1) ranked[0].mostEffective = true;

  const paid = channels.filter((c) => c.spend > 0);
  const paidSpend = paid.reduce((s, c) => s + c.spend, 0);
  const paidCustomers = paid.reduce((s, c) => s + c.customers, 0);
  return {
    months: [...window],
    channels: channels.sort((a, b) => b.share - a.share || b.spend - a.spend),
    average: paidCustomers ? Math.round(paidSpend / paidCustomers) : null, // over channels with spend recorded
    hasSpend: paidSpend > 0,
    newCustomers: total,
  };
}
