import type { Metadata } from "next";
import { QuoteWizard } from "@/components/QuoteWizard";

export const metadata: Metadata = {
  title: "Get a quote | Standard Projects",
  description: "Tell us what you need and we'll come back with a quote.",
};

/**
 * Public quote form. Link to it from the website, or embed it with
 * <iframe src="https://<crm-domain>/quote?embed=1">, which drops the page header and background.
 */
export default async function QuotePage({ searchParams }: { searchParams: Promise<{ embed?: string }> }) {
  const embed = (await searchParams).embed === "1";
  const form = (
    <div className={embed ? "p-4" : "card p-6 md:p-8"}>
      <QuoteWizard />
    </div>
  );
  if (embed) return <main className="bg-white">{form}</main>;

  return (
    <main className="min-h-screen px-4 py-10 md:py-16">
      <div className="mx-auto max-w-2xl">
        <a href="https://www.standardprojects.org" className="text-lg font-bold tracking-tight">
          Standard Projects
        </a>
        <h1 className="mt-6 text-3xl font-bold tracking-tight md:text-4xl">Get a quote</h1>
        <p className="mt-2 mb-8 text-slate-600">
          Answer a few quick questions, about 2 minutes, and we&apos;ll come back with a tailored quote.
        </p>
        {form}
      </div>
    </main>
  );
}
