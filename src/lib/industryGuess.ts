/**
 * Works out a lead's industry (one of SEGMENTS) from its company name and industry notes, e.g.
 * "plumbers | Australia Adelaide" → Trades, "ร้านนวดเชียงใหม่" → Spa. Pure, unit-tested.
 */
import type { SEGMENTS } from "./domain";

type Segment = (typeof SEGMENTS)[number];

// Checked in order: the first group with a match wins, so more specific groups come first.
const RULES: [Segment, RegExp][] = [
  ["Multi-location", /multi-location|multi-branch|chain of/],
  ["Cannabis-CBD", /cannabis|dispensary|\bcbd\b|\bweed\b|กัญชา/],
  ["Consignment", /consign|resale|vintage|second ?hand|thrift|pre-?owned|มือสอง|ฝากขาย/],
  ["Gym", /gyms?\b|fitness|swimming lesson|swim school|muay ?thai|crossfit|boxing|martial art|\bmma\b|jiu ?jitsu|ยิม|ฟิตเนส|มวยไทย/],
  ["Clinic", /clinic|dental|dentist|orthodont|hair transplant|medical|doctor|aesthetic|botox|dermatolog|veterinar|\bvet\b|optician|optometr|physio|chiropract|osteopath|podiatr|medspa|med spa|coolsculpt|hospital|คลินิก|ทันตกรรม|โรงพยาบาล|praxis|zahnarzt|arzt/],
  ["Spa", /\bspa\b|massage|waxing|threading|tanning|salon|beauty|\bnails?\b|manicure|lash|brow|facial|barber|\bcuts\b|hair ?(salon|dresser|stylist)|tattoo|makeup artist|นวด|สปา|ความงาม|ทำเล็บ|kosmetik/],
  ["Wellness", /yoga|pilates|wellness|retreat|meditation|acupunct|red light|sauna|reiki|holistic|โยคะ|สุขภาพ/],
  ["Hospitality", /hotel|hostel|guest ?house|resort|\bvilla|b ?& ?b|\bbnb\b|\blodge|homestay|serviced apartment|โรงแรม|รีสอร์ท|เกสต์เฮาส์|ที่พัก|pension|gasthof/],
  ["Restaurant", /restaurant|\bcaf[eé]|coffee(?! plantation| farm| mill)|roaster|barist|pastry|dessert|noodle|tom yum|khao ?so|kanom|ramen|\bbar\b|\bpub\b|bistro|bakery|pizz|burger|sushi|diner|catering|food truck|ร้านอาหาร|คาเฟ่|ร้านกาแฟ|เบเกอรี่|gaststätte|bäckerei/],
  ["Rental", /rental|\bhire\b|car auction|scooter|motorbike|big ?bike|limo|car storage|self storage|เช่า/],
  [
    "Trades",
    /plumb|electric|locksmith|roof|landscap|lawn|garden(er|ing)|pressure wash|window clean|drain|septic|heating|hvac|air ?con|boiler|bathroom|kitchen fit|remodel|renovat|floor|paint(er|ing)|builder|construction|carpent|joiner|mechanic|smash repair|panel beat|auto repair|garage|pest control|pest management|extermin|cleaning|appliance repair|detailing|detailer|motorcycle repair|foundation repair|door repair|auto body|muffler|insulation|wheel alignment|tow(ing| truck)|alarm|security install|fireplace|chimney|windshield|drywall|drilling|pool service|car repair|oil change|car wash|laundromat|roadside|welding|salvage|scrap|upholster|house washing|kitchens?\b|drill|piling|water boring|soil testing|mining|shutdown|\bbuilding\b|\btyres?\b|\btires?\b|window(s| install| and door| glass)|cleaners|handyman|fenc|paving|glaz|gutter|til(er|ing)|plaster|solar|removal|moving|tree (surgeon|service)|ช่าง|ก่อสร้าง|รับเหมา|handwerk|sanitär|elektriker|dachdecker|maler|tischler/,
  ],
  ["Professional-Services", /accountant|accounting|bookkeep|lawyer|solicitor|law firm|attorney|legal|consult|real estate|estate agent|realtor|insurance|architect|recruit|home staging|home inspection|notary|\btax\b|financial advis|บัญชี|ทนาย|อสังหา|steuerberater|rechtsanwalt|kanzlei/],
  ["Export-Trading", /export|trading|import|wholesale|manufactur|plantation|factory|distribut|trucking|logistics|freight|ส่งออก|นำเข้า|โรงงาน|ขายส่ง/],
  ["Website-Marketing", /marketing agency|web design|digital agency|seo agency|advertising/],
  ["Retail", /\bshop\b|\bstore\b|shops\b|stores\b|dealership|car dealer|rv dealer|auto parts|sporting goods|eyewear|optik|supermarket|otop|motorcycle dealer|bicycle|propane|3d printing|boutique|antique|furniture|gallery|jewel|silver|florist|pharmacy|bookshop|music|clothing|fashion|retail|ร้านค้า|เครื่องเงิน|เสื้อผ้า|geschäft|laden/],
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
