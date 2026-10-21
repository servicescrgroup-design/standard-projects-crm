// Merges imports/intl-leads/batch-*.json into imports/international-leads.json (one upload for
// Settings → Import leads). Drops rows missing required fields and duplicates by website domain or
// name + city + country, then prints a breakdown. Usage: node scripts/merge-research.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "imports/intl-leads");
const out = join(process.cwd(), "imports/international-leads.json");
const STATUSES = new Set(["none", "outdated", "no-english"]);

const domain = (url) => {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
};

const seen = new Set();
const rows = [];
const dropped = { invalid: 0, duplicate: 0 };
for (const f of readdirSync(dir).filter((f) => /^batch-.*\.json$/.test(f)).sort()) {
  let data;
  try {
    data = JSON.parse(readFileSync(join(dir, f), "utf8"));
  } catch (e) {
    console.error(`${f}: not valid JSON (${e.message})`);
    continue;
  }
  for (const r of Array.isArray(data) ? data : []) {
    const ok = r && typeof r.company === "string" && r.company.trim() && typeof r.country === "string" && STATUSES.has(r.websiteStatus)
      && typeof r.whyFit === "string" && r.whyFit.trim() && typeof r.sourceLink === "string" && /^https?:\/\//.test(r.sourceLink);
    if (!ok) {
      dropped.invalid++;
      continue;
    }
    const key = domain(r.website) ?? `${r.company.toLowerCase().trim()}|${(r.city ?? "").toLowerCase()}|${r.country.toLowerCase()}`;
    if (seen.has(key)) {
      dropped.duplicate++;
      continue;
    }
    seen.add(key);
    rows.push({ ...r, _batch: f });
  }
}

writeFileSync(out, JSON.stringify(rows.map(({ _batch, ...r }) => r), null, 1));
const count = (k) => Object.entries(rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
console.log(`${rows.length} leads → ${out}`);
console.log(`dropped: ${dropped.invalid} invalid, ${dropped.duplicate} duplicate`);
console.log("by country:", count("country").map(([k, v]) => `${k} ${v}`).join(", "));
console.log("by niche:", count("niche").map(([k, v]) => `${k} ${v}`).join(", "));
console.log("by status:", count("websiteStatus").map(([k, v]) => `${k} ${v}`).join(", "));
console.log("by batch:", count("_batch").map(([k, v]) => `${k} ${v}`).join(", "));
