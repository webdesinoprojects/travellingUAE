import { Globe2, ShieldCheck, Wifi } from "lucide-react";

import { CountryPicker } from "@/components/esim/CountryPicker";
import { getLocalAirhubCountries } from "@/server/providers/airhub/countries";

export const dynamic = "force-dynamic";

export default async function EsimPage() {
  const countries = await getLocalAirhubCountries({ limit: 250 });

  return (
    <main className="min-h-screen bg-background pb-20 pt-32 text-brand-navy dark:text-white">
      <section className="border-y border-border-soft bg-surface">
        <div className="mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-blue dark:text-brand-sand">
            Travel connectivity
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">
            eSIM plans
          </h1>
          <div className="mt-5 flex flex-wrap gap-3 text-sm font-bold text-brand-navy/65 dark:text-white/65">
            <span className="inline-flex items-center gap-2">
              <Globe2 className="size-4" aria-hidden="true" />
              Country plans
            </span>
            <span className="inline-flex items-center gap-2">
              <Wifi className="size-4" aria-hidden="true" />
              Instant-ready checkout
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Secure payment
            </span>
          </div>
        </div>
      </section>

      <CountryPicker countries={countries} />
    </main>
  );
}
