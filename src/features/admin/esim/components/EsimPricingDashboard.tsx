"use client";

import { Calculator, Globe2, PackageSearch } from "lucide-react";
import { useMemo, useState } from "react";

import { formatEsimMoney } from "@/features/admin/esim/format";
import type {
  AdminPricingPageModel,
  AdminPricingPlanOption,
  AdminPricingRule,
} from "@/features/admin/esim/pricing-types";

import { EsimPricingRuleForm } from "./EsimPricingRuleForm";

export function EsimPricingDashboard({ model }: { model: AdminPricingPageModel }) {
  const firstCountry = model.countries[0]?.isoCode ?? "";
  const firstPlan = model.plans[0] ?? null;
  const [countryCode, setCountryCode] = useState(firstCountry);
  const [planCountryCode, setPlanCountryCode] = useState(firstPlan?.countryCode ?? firstCountry);
  const [planCode, setPlanCode] = useState(firstPlan?.planCode ?? "");

  const globalRule = findRule(model.rules, "global", null, null);
  const countryRule = findRule(model.rules, "country", countryCode, null);
  const planRule = findRule(model.rules, "plan", planCountryCode, planCode);
  const plansForCountry = useMemo(
    () => model.plans.filter((plan) => plan.countryCode === planCountryCode),
    [model.plans, planCountryCode],
  );
  const selectedPlan = plansForCountry.find((plan) => samePlan(plan.planCode, planCode)) ?? null;

  return (
    <div className="grid gap-5">
      <section className="grid gap-3">
        <SectionHeader icon={<Calculator className="size-5" />} title="Global rule" />
        <EsimPricingRuleForm title="Default pricing" scope="global" rule={globalRule} />
      </section>

      <section className="grid gap-3">
        <SectionHeader icon={<Globe2 className="size-5" />} title="Country rule" />
        <div className="rounded-lg border border-[#d7c5ad] bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <label className="grid gap-1.5 sm:max-w-sm">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
              Country
            </span>
            <input
              list="esim-pricing-country-options"
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
              className={inputClass}
              placeholder="US"
            />
          </label>
          <datalist id="esim-pricing-country-options">
            {model.countries.map((country) => (
              <option key={country.isoCode} value={country.isoCode}>
                {country.name}
              </option>
            ))}
          </datalist>
        </div>
        <EsimPricingRuleForm
          title={countryCode ? `${countryCode} pricing` : "Country pricing"}
          scope="country"
          countryCode={countryCode}
          rule={countryRule}
          disabled={!isCountryCode(countryCode)}
          disabledMessage={!isCountryCode(countryCode) ? "Enter a 2-letter country code." : undefined}
        />
      </section>

      <section className="grid gap-3">
        <SectionHeader icon={<PackageSearch className="size-5" />} title="Plan rule" />
        <div className="grid gap-3 rounded-lg border border-[#d7c5ad] bg-white/60 p-4 dark:border-white/10 dark:bg-white/[0.04] sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
              Country
            </span>
            <input
              list="esim-pricing-country-options"
              value={planCountryCode}
              onChange={(event) => setPlanCountryCode(event.target.value.toUpperCase().slice(0, 2))}
              maxLength={2}
              className={inputClass}
              placeholder="US"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
              Plan code
            </span>
            <input
              list="esim-pricing-plan-options"
              value={planCode}
              onChange={(event) => setPlanCode(event.target.value)}
              maxLength={120}
              className={inputClass}
              placeholder="Plan code"
            />
          </label>
          <datalist id="esim-pricing-plan-options">
            {plansForCountry.map((plan) => (
              <option key={`${plan.countryCode}:${plan.planCode}`} value={plan.planCode}>
                {plan.planName ?? plan.planCode}
              </option>
            ))}
          </datalist>
          <div className="sm:col-span-2">
            <PlanHint plan={selectedPlan} />
          </div>
        </div>
        <EsimPricingRuleForm
          title={planCode ? `${planCountryCode} / ${planCode}` : "Plan pricing"}
          scope="plan"
          countryCode={planCountryCode}
          planCode={planCode}
          rule={planRule}
          disabled={!isCountryCode(planCountryCode) || !planCode.trim()}
          disabledMessage={
            !isCountryCode(planCountryCode) || !planCode.trim()
              ? "Enter a country and plan code."
              : undefined
          }
        />
      </section>

      <RulesList rules={model.rules} />
    </div>
  );
}

function RulesList({ rules }: { rules: AdminPricingRule[] }) {
  if (rules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#d7c5ad] bg-white/60 p-6 text-sm font-bold text-brand-brown dark:border-white/10 dark:bg-white/[0.04]">
        No pricing rules have been saved yet.
      </div>
    );
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-black">Saved rules</h2>
      <ul className="grid gap-2">
        {rules.map((rule) => (
          <li
            key={rule.id}
            className="flex flex-col gap-2 rounded-lg border border-[#e4d6bf] bg-white p-4 text-sm font-bold dark:border-white/10 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-black">
                {rule.scope}
                {rule.countryCode ? ` / ${rule.countryCode}` : ""}
                {rule.planCode ? ` / ${rule.planCode}` : ""}
              </p>
              <p className="text-xs text-brand-brown">
                {rule.markupPercent}% + {rule.markupFixed} fixed - min {rule.minMargin} -{" "}
                {rule.roundingMode}
              </p>
            </div>
            <span className="text-xs font-black uppercase text-brand-brown">
              {rule.isActive ? "Active" : "Inactive"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlanHint({ plan }: { plan: AdminPricingPlanOption | null }) {
  if (!plan) {
    return <p className="text-xs font-bold text-brand-brown">Manual plan code entry.</p>;
  }

  return (
    <p className="text-xs font-bold text-brand-brown">
      {plan.planName ?? plan.planCode} - supplier {formatEsimMoney(plan.supplierPrice, plan.currency)}
    </p>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-brand-navy dark:text-white">
      {icon}
      <h2 className="text-lg font-black">{title}</h2>
    </div>
  );
}

function findRule(
  rules: AdminPricingRule[],
  scope: AdminPricingRule["scope"],
  countryCode: string | null,
  planCode: string | null,
) {
  const matching = rules.filter(
    (rule) =>
      rule.scope === scope &&
      sameNullable(rule.countryCode, countryCode) &&
      sameNullable(rule.planCode, planCode),
  );
  return matching.find((rule) => rule.isActive) ?? matching[0] ?? null;
}

function sameNullable(left: string | null, right: string | null) {
  if (!left && !right) return true;
  return (left ?? "").toLowerCase() === (right ?? "").toLowerCase();
}

function samePlan(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function isCountryCode(value: string) {
  return /^[A-Z]{2}$/.test(value.trim().toUpperCase());
}

const inputClass =
  "h-11 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white";
