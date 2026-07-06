"use client";

import type {
  PlanFilterQuery,
  PlanPhoneFilter,
  PlanRenewalFilter,
} from "@/server/providers/airhub/plan-search";

const PHONE_OPTIONS: Array<{ value: PlanPhoneFilter; label: string }> = [
  { value: "all", label: "All plan types" },
  { value: "data_only", label: "Data only" },
  { value: "voice_data", label: "Voice + Data" },
];

const RENEWAL_OPTIONS: Array<{ value: PlanRenewalFilter; label: string }> = [
  { value: "all", label: "All plans" },
  { value: "available", label: "Renewal available" },
  { value: "one_time", label: "One-time only" },
];

/** Real-field-only filters: phoneNumber, subscription, networkOperator. */
export function PlanFilterSelects({
  query,
  operators,
  onChange,
}: {
  query: PlanFilterQuery;
  operators: string[];
  onChange: (patch: Partial<PlanFilterQuery>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <LabeledSelect
        label="Plan type"
        value={query.phoneFilter}
        onChange={(value) => onChange({ phoneFilter: value as PlanPhoneFilter })}
        options={PHONE_OPTIONS}
      />
      <LabeledSelect
        label="Renewal"
        value={query.renewalFilter}
        onChange={(value) => onChange({ renewalFilter: value as PlanRenewalFilter })}
        options={RENEWAL_OPTIONS}
      />
      <LabeledSelect
        label="Operator"
        value={query.operator}
        onChange={(value) => onChange({ operator: value })}
        options={[
          { value: "all", label: "All operators" },
          ...operators.map((operator) => ({ value: operator, label: operator })),
        ]}
        className="col-span-2 sm:col-span-1"
      />
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <label className={`grid min-w-0 gap-1 ${className}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full min-w-0 truncate rounded-lg border border-border-soft bg-surface px-2.5 text-xs font-bold text-brand-navy outline-none focus:border-brand-blue sm:text-sm dark:text-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
