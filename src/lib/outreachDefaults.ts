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
];
