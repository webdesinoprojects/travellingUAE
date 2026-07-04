"use client";

import { Check, Loader2, Save } from "lucide-react";
import { useState } from "react";

import type { AdminPricingRule } from "@/features/admin/esim/pricing-types";
import type {
  EsimPricingScope,
  EsimRoundingMode,
} from "@/server/esim/pricing-helpers";

import { useControlSave } from "./use-control-save";

const PRICING_URL = "/api/admin/esim/pricing";

const ROUNDING_OPTIONS: Array<{ value: EsimRoundingMode; label: string }> = [
  { value: "none", label: "No rounding" },
  { value: "nearest_0_99", label: "Round up to .99" },
  { value: "nearest_0_49", label: "Round up to .49/.99" },
  { value: "whole", label: "Round up to whole" },
];

type FormState = {
  markupPercent: string;
  markupFixed: string;
  minMargin: string;
  roundingMode: EsimRoundingMode;
  isActive: boolean;
};

export function EsimPricingRuleForm({
  title,
  scope,
  countryCode,
  planCode,
  rule,
  disabled = false,
  disabledMessage,
}: {
  title: string;
  scope: EsimPricingScope;
  countryCode?: string | null;
  planCode?: string | null;
  rule: AdminPricingRule | null;
  disabled?: boolean;
  disabledMessage?: string;
}) {
  const { state, message, save } = useControlSave();
  const identity = `${scope}:${countryCode ?? ""}:${planCode ?? ""}:${rule?.id ?? "new"}`;
  const [lastIdentity, setLastIdentity] = useState(identity);
  const [form, setForm] = useState<FormState>(() => valuesFromRule(rule));

  if (identity !== lastIdentity) {
    setLastIdentity(identity);
    setForm(valuesFromRule(rule));
  }

  const busy = state === "saving";
  const canSave = !disabled && !busy;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;

    await save(PRICING_URL, {
      scope,
      countryCode: countryCode ?? null,
      planCode: planCode ?? null,
      markupPercent: toNumber(form.markupPercent),
      markupFixed: toNumber(form.markupFixed),
      minMargin: toNumber(form.minMargin),
      roundingMode: form.roundingMode,
      isActive: form.isActive,
    });
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="rounded-lg border border-[#d7c5ad] bg-white/78 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.06]"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black">{title}</h2>
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-brown">
            {rule ? "Existing rule" : "New rule"}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-black text-brand-navy dark:text-white">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            className="size-4 rounded border-border-soft"
          />
          Active
        </label>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Field label="Markup %">
          <input
            value={form.markupPercent}
            onChange={(event) => setForm({ ...form, markupPercent: event.target.value })}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
        <Field label="Fixed markup">
          <input
            value={form.markupFixed}
            onChange={(event) => setForm({ ...form, markupFixed: event.target.value })}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
        <Field label="Min margin">
          <input
            value={form.minMargin}
            onChange={(event) => setForm({ ...form, minMargin: event.target.value })}
            inputMode="decimal"
            className={inputClass}
          />
        </Field>
        <Field label="Rounding">
          <select
            value={form.roundingMode}
            onChange={(event) =>
              setForm({ ...form, roundingMode: event.target.value as EsimRoundingMode })
            }
            className={inputClass}
          >
            {ROUNDING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSave}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : state === "saved" ? (
            <Check className="size-4" />
          ) : (
            <Save className="size-4" />
          )}
          Save rule
        </button>
        {disabledMessage ? (
          <p className="text-sm font-bold text-brand-brown">{disabledMessage}</p>
        ) : null}
        {message ? (
          <p className="text-sm font-bold text-red-600 dark:text-red-400">{message}</p>
        ) : null}
      </div>
    </form>
  );
}

function valuesFromRule(rule: AdminPricingRule | null): FormState {
  return {
    markupPercent: String(rule?.markupPercent ?? 0),
    markupFixed: String(rule?.markupFixed ?? 0),
    minMargin: String(rule?.minMargin ?? 0),
    roundingMode: rule?.roundingMode ?? "none",
    isActive: rule?.isActive ?? true,
  };
}

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-brand-brown">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white";
