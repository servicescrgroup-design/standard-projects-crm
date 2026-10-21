/** Quote maths and validation. Money in satang (minor units). Pure, unit-tested. */

export type QuoteItem = { name: string; description?: string; qty: number; unitPrice: number; monthly: boolean };

export function sanitizeItems(raw: unknown): QuoteItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const qty = Math.max(1, Math.min(999, Math.round(Number(o.qty) || 1)));
      const unitPrice = Math.max(0, Math.min(1_000_000_000_00, Math.round(Number(o.unitPrice) || 0)));
      return {
        name: String(o.name ?? "").trim().slice(0, 200),
        description: String(o.description ?? "").trim().slice(0, 1000) || undefined,
        qty,
        unitPrice,
        monthly: o.monthly === true,
      };
    })
    .filter((i) => i.name)
    .slice(0, 50);
}

export function quoteTotals(items: QuoteItem[], discount = 0) {
  const oneOffGross = items.filter((i) => !i.monthly).reduce((t, i) => t + i.qty * i.unitPrice, 0);
  const monthly = items.filter((i) => i.monthly).reduce((t, i) => t + i.qty * i.unitPrice, 0);
  const appliedDiscount = Math.min(Math.max(0, discount), oneOffGross);
  const oneOff = oneOffGross - appliedDiscount;
  return { oneOffGross, discount: appliedDiscount, oneOff, monthly, firstYear: oneOff + monthly * 12 };
}

/** Q-2026-0007 */
export function quoteNumber(year: number, sequence: number): string {
  return `Q-${year}-${String(sequence).padStart(4, "0")}`;
}

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
};

export function isExpired(validUntil: Date | null, now = new Date()): boolean {
  if (!validUntil) return false;
  const end = new Date(validUntil);
  end.setHours(23, 59, 59, 999);
  return end < now;
}
