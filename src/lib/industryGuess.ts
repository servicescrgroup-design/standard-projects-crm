/**
 * Works out a lead's industry (one of SEGMENTS) from its company name and industry notes, e.g.
 * "plumbers | Australia Adelaide" → Trades, "ร้านนวดเชียงใหม่" → Spa. Pure, unit-tested.
 */
import type { SEGMENTS } from "./domain";

type Segment = (typeof SEGMENTS)[number];

// Checked in order: the first group with a match wins, so more specific groups come first.
const RULES: [Segment, RegExp][] = [
  ["Cannabis-CBD", /cannabis|dispensary|\bcbd\b|\bweed\b|กัญชา/],
  ["Consignment", /consignment|resale|second ?hand|thrift|pre-?owned|มือสอง|ฝากขาย/],
  ["Gym", /\bgym|fitness|muay ?thai|crossfit|boxing|martial art|\bmma\b|jiu ?jitsu|ยิม|ฟิตเนส|มวยไทย/],
  ["Clinic", /clinic|dental|dentist|orthodont|hair transplant|medical|doctor|aesthetic|botox|dermatolog|veterinar|\bvet\b|optician|optometr|physio|chiropract|hospital|คลินิก|ทันตกรรม|โรงพยาบาล|praxis|zahnarzt|arzt/],
  ["Spa", /\bspa\b|massage|waxing|threading|tanning|salon|beauty|\bnails?\b|lash|brow|facial|barber|นวด|สปา|ความงาม|ทำเล็บ|kosmetik/],
  ["Wellness", /yoga|pilates|wellness|retreat|meditation|acupunct|red light|sauna|reiki|holistic|โยคะ|สุขภาพ/],
  ["Hospitality", /hotel|hostel|guest ?house|resort|\bvilla|b ?& ?b|\bbnb\b|\blodge|homestay|serviced apartment|โรงแรม|รีสอร์ท|เกสต์เฮาส์|ที่พัก|pension|gasthof/],
  ["Restaurant", /restaurant|\bcaf[eé]|coffee shop|\bbar\b|\bpub\b|bistro|bakery|pizz|burger|sushi|diner|catering|food truck|ร้านอาหาร|คาเฟ่|ร้านกาแฟ|เบเกอรี่|gaststätte|bäckerei/],
  ["Rental", /rental|\bhire\b|car auction|scooter|motorbike|big ?bike|เช่า/],
  [
    "Trades",
    /plumb|electric|locksmith|roof|landscap|lawn|garden(er|ing)|pressure wash|window clean|drain|septic|heating|hvac|air ?con|boiler|bathroom|kitchen fit|remodel|renovat|floor|paint(er|ing)|builder|construction|carpent|joiner|mechanic|smash repair|panel beat|auto repair|garage|pest control|cleaning|cleaners|handyman|fenc|paving|glaz|gutter|til(er|ing)|plaster|solar|removal|moving|tree (surgeon|service)|ช่าง|ก่อสร้าง|รับเหมา|handwerk|sanitär|elektriker|dachdecker|maler|tischler/,
  ],
  ["Professional-Services", /accountant|accounting|bookkeep|lawyer|solicitor|law firm|attorney|legal|consult|real estate|estate agent|realtor|insurance|architect|recruit|notary|\btax\b|financial advis|บัญชี|ทนาย|อสังหา|steuerberater|rechtsanwalt|kanzlei/],
  ["Export-Trading", /export|trading|import|wholesale|manufactur|plantation|factory|distribut|ส่งออก|นำเข้า|โรงงาน|ขายส่ง/],
  ["Website-Marketing", /marketing agency|web design|digital agency|seo agency|advertising/],
  ["Retail", /\bshop\b|\bstore\b|boutique|antique|furniture|gallery|jewel|silver|florist|pharmacy|bookshop|music|clothing|fashion|retail|ร้านค้า|เครื่องเงิน|เสื้อผ้า|geschäft|laden/],
];

/** The best-guess industry, or null when nothing fits. */
export function guessIndustry(lead: { company: string; industry?: string | null; notes?: string | null; whyFit?: string | null }): Segment | null {
  // The industry note first (most reliable), then the company name, then free-text notes.
  for (const text of [lead.industry, lead.company, lead.whyFit, lead.notes]) {
    const t = (text ?? "").toLowerCase();
    if (!t.trim()) continue;
    for (const [segment, re] of RULES) if (re.test(t)) return segment;
  }
  return null;
}
