/** Starter templates and sequences, added the first time someone opens Outreach. Everything is editable. */

export const DEFAULT_TEMPLATES = [
  {
    key: "intro_en",
    name: "Website intro",
    category: "Intro",
    language: "en",
    subject: "Quick idea for {{company}}'s website",
    body: `Hi {{first_name|there}},

I came across {{company}} while looking at {{industry|businesses}} in {{city|your area}}. {{why_fit}}

We're Standard Projects, a small studio that builds fast, mobile-friendly websites that turn visitors into bookings and enquiries. For a business like yours that usually means:
- a clean site that works perfectly on phones
- online booking or enquiry forms that land straight in your inbox
- showing up properly on Google and Google Maps

Would a free 15-minute call next week be useful? I can share a few ideas specific to {{company}}, with no obligation.

Best regards,
{{agent_name}}
Standard Projects · standardprojects.org`,
  },
  {
    key: "followup_en",
    name: "Follow-up (short)",
    category: "Follow-up",
    language: "en",
    subject: "Re: Quick idea for {{company}}'s website",
    body: `Hi {{first_name|there}},

Just bringing this back to the top of your inbox. Happy to send a couple of example sites we've built for {{industry|businesses like yours}} if that's easier than a call.

{{agent_name}}`,
  },
  {
    key: "case_en",
    name: "Case study",
    category: "Case study",
    language: "en",
    subject: "How a business like {{company}} got more bookings",
    body: `Hi {{first_name|there}},

We've built websites and booking systems for spas, cafés, shops and service businesses. You can see a few of them here: standardprojects.org/portfolio

We could do something similar for {{company}}, with a clear fixed price agreed up front and full ownership of your site.

Shall I put together a quick proposal?

{{agent_name}}
Standard Projects`,
  },
  {
    key: "breakup_en",
    name: "Last email",
    category: "Break-up",
    language: "en",
    subject: "Should I close your file?",
    body: `Hi {{first_name|there}},

I haven't heard back, so I'll assume now isn't the right time and won't keep emailing.

If a new website for {{company}} becomes a priority later, just reply to this email and I'll pick it up straight away.

All the best,
{{agent_name}}`,
  },
  {
    key: "intro_th",
    name: "แนะนำเว็บไซต์ (ภาษาไทย)",
    category: "Intro",
    language: "th",
    subject: "ไอเดียเว็บไซต์สำหรับ {{company}}",
    body: `สวัสดีครับ/ค่ะ คุณ{{first_name|ผู้ดูแล}}

ทาง Standard Projects ได้เห็น {{company}} และคิดว่าเว็บไซต์ที่ดีจะช่วยให้ลูกค้าหาร้านเจอและจองได้ง่ายขึ้น {{why_fit}}

เราทำเว็บไซต์ที่โหลดเร็ว ใช้งานบนมือถือได้ดี มีระบบจองหรือฟอร์มติดต่อที่ส่งตรงถึงคุณ และช่วยให้ร้านแสดงผลบน Google และ Google Maps ได้ดีขึ้น

สะดวกคุยสั้นๆ 15 นาทีในสัปดาห์หน้าไหมครับ/คะ? ไม่มีค่าใช้จ่ายและไม่มีข้อผูกมัด

ขอบคุณครับ/ค่ะ
{{agent_name}}
Standard Projects · standardprojects.org`,
  },
  {
    key: "followup_th",
    name: "ติดตามผล (ภาษาไทย)",
    category: "Follow-up",
    language: "th",
    subject: "Re: ไอเดียเว็บไซต์สำหรับ {{company}}",
    body: `สวัสดีครับ/ค่ะ คุณ{{first_name|ผู้ดูแล}}

ขออนุญาตติดตามอีเมลก่อนหน้านี้ หากสะดวก เราสามารถส่งตัวอย่างเว็บไซต์ที่เคยทำให้ธุรกิจคล้ายกันไปให้ดูก่อนได้เลยครับ/ค่ะ

{{agent_name}}`,
  },
  {
    key: "intro_de",
    name: "Website-Idee (Deutsch)",
    category: "Intro",
    language: "de",
    subject: "Kurze Idee zur Website von {{company}}",
    body: `Guten Tag,

ich bin auf {{company}} gestoßen und habe mir Ihren Online-Auftritt angesehen. Mit einer modernen Website könnten Sie meiner Meinung nach deutlich mehr Anfragen und Buchungen gewinnen.

Wir sind Standard Projects, ein kleines Studio für schnelle, mobilfreundliche Websites. Für Unternehmen wie Ihres bedeutet das meist:
- eine klare Website, die auf jedem Smartphone einwandfrei funktioniert
- Online-Buchung oder Kontaktformulare, die direkt in Ihrem Postfach landen
- bessere Sichtbarkeit bei Google und Google Maps

Hätten Sie nächste Woche Zeit für ein kostenloses, 15-minütiges Gespräch? Ich zeige Ihnen gern ein paar konkrete Ideen für {{company}} – ganz unverbindlich. Das Gespräch können wir gern auch auf Englisch führen.

Mit freundlichen Grüßen
{{agent_name}}
Standard Projects · standardprojects.org`,
  },
  {
    key: "followup_de",
    name: "Nachfassen (Deutsch)",
    category: "Follow-up",
    language: "de",
    subject: "Re: Kurze Idee zur Website von {{company}}",
    body: `Guten Tag,

ich wollte meine letzte Nachricht kurz wieder nach oben holen. Falls das einfacher ist als ein Gespräch, schicke ich Ihnen gern ein paar Beispiele von Websites, die wir für ähnliche Unternehmen umgesetzt haben.

Viele Grüße
{{agent_name}}`,
  },
  {
    key: "case_de",
    name: "Referenzen (Deutsch)",
    category: "Case study",
    language: "de",
    subject: "Wie ähnliche Unternehmen mehr Buchungen gewinnen",
    body: `Guten Tag,

wir haben Websites und Buchungssysteme für Spas, Cafés, Geschäfte und Dienstleister umgesetzt. Einige Beispiele finden Sie hier: standardprojects.org/portfolio

Für {{company}} könnten wir etwas Ähnliches umsetzen – zu einem vorab vereinbarten Festpreis, und die Website gehört anschließend vollständig Ihnen.

Soll ich Ihnen ein kurzes, unverbindliches Angebot zusammenstellen?

Mit freundlichen Grüßen
{{agent_name}}
Standard Projects`,
  },
  {
    key: "breakup_de",
    name: "Letzte E-Mail (Deutsch)",
    category: "Break-up",
    language: "de",
    subject: "Meine letzte Nachricht",
    body: `Guten Tag,

da ich nichts von Ihnen gehört habe, gehe ich davon aus, dass das Thema gerade nicht passt, und melde mich daher nicht weiter.

Falls eine neue Website für {{company}} später interessant wird, antworten Sie einfach auf diese E-Mail und ich melde mich umgehend.

Alles Gute
{{agent_name}}`,
  },
] as const;

export const DEFAULT_SEQUENCES = [
  {
    name: "Website outreach (English, 4 emails)",
    description: "Intro, a nudge after 3 days, a case study after a week, and a polite last email. Stops as soon as they reply.",
    steps: [
      { template: "intro_en", waitDays: 0 },
      { template: "followup_en", waitDays: 3 },
      { template: "case_en", waitDays: 4 },
      { template: "breakup_en", waitDays: 7 },
    ],
  },
  {
    name: "แนะนำเว็บไซต์ (ภาษาไทย, 2 อีเมล)",
    description: "สำหรับลูกค้าในไทย: แนะนำ และติดตามผลหลัง 4 วัน",
    steps: [
      { template: "intro_th", waitDays: 0 },
      { template: "followup_th", waitDays: 4 },
    ],
  },
  {
    name: "Website-Ansprache (Deutsch, 4 E-Mails)",
    description: "For German-speaking leads (Germany, Austria, Switzerland): intro, a nudge after 3 days, references after a week, and a polite last email.",
    steps: [
      { template: "intro_de", waitDays: 0 },
      { template: "followup_de", waitDays: 3 },
      { template: "case_de", waitDays: 4 },
      { template: "breakup_de", waitDays: 7 },
    ],
  },
];
