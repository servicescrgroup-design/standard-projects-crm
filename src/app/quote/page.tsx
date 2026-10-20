import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { QuoteWizard } from "@/components/QuoteWizard";
import type { Lang } from "@/lib/quote";

export const metadata: Metadata = {
  title: "Get a quote | Standard Projects",
  description: "Tell us what you need and we'll come back with a quote. / บอกเราว่าคุณต้องการอะไร แล้วเราจะส่งใบเสนอราคาให้",
};

const COPY = {
  title: { en: "Get a quote", th: "ขอใบเสนอราคา" },
  intro: {
    en: "Answer a few quick questions, about 2 minutes, and we'll come back with a tailored quote.",
    th: "ตอบคำถามสั้นๆ ไม่กี่ข้อ ใช้เวลาประมาณ 2 นาที แล้วเราจะส่งใบเสนอราคาที่เหมาะกับธุรกิจของคุณ",
  },
};

/**
 * Public quote form. Link to it from the website (add ?lang=th for Thai), or embed it with
 * <iframe src="https://<crm-domain>/quote?embed=1">, which drops the page header and background.
 */
export default async function QuotePage({ searchParams }: { searchParams: Promise<{ embed?: string; lang?: string }> }) {
  const params = await searchParams;
  const embed = params.embed === "1";
  const acceptsThai = /^th\b/i.test((await headers()).get("accept-language") ?? "");
  const lang: Lang = params.lang === "th" || (params.lang !== "en" && acceptsThai) ? "th" : "en";

  const form = (
    <div className={embed ? "p-4" : "card p-6 md:p-8"}>
      <Suspense>
        <QuoteWizard initialLang={lang} />
      </Suspense>
    </div>
  );
  if (embed) return <main className="bg-white">{form}</main>;

  return (
    <main className="min-h-screen px-4 py-10 md:py-16" lang={lang}>
      <div className="mx-auto max-w-2xl">
        <a href="https://www.standardprojects.org" className="text-lg font-bold tracking-tight">
          Standard Projects
        </a>
        <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">{COPY.title[lang]}</h1>
        <p className="mt-2 mb-8 text-ink-2">{COPY.intro[lang]}</p>
        {form}
      </div>
    </main>
  );
}
