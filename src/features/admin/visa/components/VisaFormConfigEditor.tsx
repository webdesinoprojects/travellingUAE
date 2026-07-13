"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import {
  VISA_FIELD_TYPES,
  type VisaApplyFormConfig,
  type VisaCallFormConfig,
  type VisaContactCardsConfig,
  type VisaFormFieldConfig,
  type VisaFormFieldType,
} from "@/lib/visa-forms";

/**
 * CMS editors for the public Apply Online + Let-us-Call-You forms and the
 * sidebar contact cards. Non-technical: toggles, text inputs, and add/reorder/
 * delete buttons — no JSON.
 */

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-black uppercase tracking-[0.08em] text-brand-brown">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-9 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-2.5 text-sm font-semibold outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white"
      />
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm font-black">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-brand-blue" />
      {label}
    </label>
  );
}

function FieldsEditor({ fields, onChange }: { fields: VisaFormFieldConfig[]; onChange: (v: VisaFormFieldConfig[]) => void }) {
  function update(index: number, patch: Partial<VisaFormFieldConfig>) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addCustom() {
    const key = `custom_${Date.now().toString(36)}`;
    onChange([...fields, { key, label: "New field", type: "text", required: false, enabled: true, custom: true }]);
  }

  return (
    <div className="grid gap-2">
      <span className="text-[11px] font-black uppercase tracking-[0.08em] text-brand-brown">Fields</span>
      {fields.map((field, index) => (
        <div key={field.key} className="rounded-lg border border-border-soft bg-surface-muted/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="truncate text-xs font-black text-brand-navy dark:text-white">
              {field.label || field.key}
              {field.custom ? <span className="ml-1 text-brand-brown">(custom)</span> : null}
            </span>
            <div className="flex items-center gap-1">
              <IconBtn label="Move up" disabled={index === 0} onClick={() => onChange(move(fields, index, index - 1))}>
                <ArrowUp className="size-3.5" aria-hidden="true" />
              </IconBtn>
              <IconBtn label="Move down" disabled={index === fields.length - 1} onClick={() => onChange(move(fields, index, index + 1))}>
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </IconBtn>
              {field.custom ? (
                <IconBtn label="Delete field" danger onClick={() => onChange(fields.filter((_, i) => i !== index))}>
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </IconBtn>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Input label="Label" value={field.label} onChange={(v) => update(index, { label: v })} />
            <label className="grid gap-1">
              <span className="text-[11px] font-black uppercase tracking-[0.08em] text-brand-brown">Type</span>
              <select
                value={field.type}
                onChange={(e) => update(index, { type: e.target.value as VisaFormFieldType })}
                disabled={!field.custom}
                className="min-h-9 rounded-lg border border-border-soft bg-[#fffaf2] px-2.5 text-sm font-bold outline-none disabled:opacity-60 dark:bg-white/10 dark:text-white"
              >
                {VISA_FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Placeholder" value={field.placeholder ?? ""} onChange={(v) => update(index, { placeholder: v })} />
            {field.type === "select" && !field.optionsFromVisaTypes ? (
              <Input
                label="Options (comma separated)"
                value={(field.options ?? []).join(", ")}
                onChange={(v) => update(index, { options: v.split(",").map((o) => o.trim()).filter(Boolean) })}
              />
            ) : field.optionsFromVisaTypes ? (
              <div className="grid gap-1">
                <span className="text-[11px] font-black uppercase tracking-[0.08em] text-brand-brown">Options</span>
                <span className="inline-flex min-h-9 items-center text-xs font-semibold text-brand-brown">Auto from this destination&apos;s visa types</span>
              </div>
            ) : null}
            <div className="flex items-center gap-5 sm:col-span-2">
              <Toggle label="Enabled" checked={field.enabled} onChange={(v) => update(index, { enabled: v })} />
              <Toggle label="Required" checked={field.required} onChange={(v) => update(index, { required: v })} />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addCustom}
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-blue/50 bg-brand-blue/5 text-xs font-black text-brand-blue"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        Add custom field
      </button>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-8 place-items-center rounded-lg border border-border-soft bg-white disabled:opacity-40 dark:bg-white/10 ${danger ? "text-red-600 dark:text-red-400" : "text-brand-navy dark:text-white"}`}
    >
      {children}
    </button>
  );
}

export function ApplyFormEditor({ value, onChange }: { value: VisaApplyFormConfig; onChange: (v: VisaApplyFormConfig) => void }) {
  const set = (patch: Partial<VisaApplyFormConfig>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3">
      <Toggle label="Show Apply Online form on the public page" checked={value.enabled} onChange={(v) => set({ enabled: v })} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input label="Heading" value={value.heading} onChange={(v) => set({ heading: v })} />
        <Input label="Submit button label" value={value.submitLabel} onChange={(v) => set({ submitLabel: v })} />
        <Input label="Helper text" value={value.helperText} onChange={(v) => set({ helperText: v })} />
        <Input label="Default travellers" type="number" value={String(value.defaultTravellers)} onChange={(v) => set({ defaultTravellers: Math.max(1, Number(v) || 1) })} />
      </div>
      <FieldsEditor fields={value.fields} onChange={(fields) => set({ fields })} />
    </div>
  );
}

export function CallFormEditor({ value, onChange }: { value: VisaCallFormConfig; onChange: (v: VisaCallFormConfig) => void }) {
  const set = (patch: Partial<VisaCallFormConfig>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3">
      <Toggle label="Show 'Let us Call You' form on the public page" checked={value.enabled} onChange={(v) => set({ enabled: v })} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Input label="Heading" value={value.heading} onChange={(v) => set({ heading: v })} />
        <Input label="Submit button label" value={value.submitLabel} onChange={(v) => set({ submitLabel: v })} />
      </div>
      <FieldsEditor fields={value.fields} onChange={(fields) => set({ fields })} />
    </div>
  );
}

export function ContactCardsEditor({ value, onChange }: { value: VisaContactCardsConfig; onChange: (v: VisaContactCardsConfig) => void }) {
  const setCard = (key: "whatsapp" | "phone" | "timing", patch: Partial<VisaContactCardsConfig["whatsapp"]>) =>
    onChange({ ...value, [key]: { ...value[key], ...patch } });

  return (
    <div className="grid gap-3">
      <Input label="Top helper strip text" value={value.helperText} onChange={(v) => onChange({ ...value, helperText: v })} />
      {(["whatsapp", "phone", "timing"] as const).map((key) => (
        <div key={key} className="rounded-lg border border-border-soft bg-surface-muted/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-black capitalize text-brand-navy dark:text-white">{key}</span>
            <Toggle label="Show" checked={value[key].enabled} onChange={(v) => setCard(key, { enabled: v })} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input label="Label" value={value[key].label} onChange={(v) => setCard(key, { label: v })} />
            <Input label="Value" value={value[key].value} onChange={(v) => setCard(key, { value: v })} />
          </div>
        </div>
      ))}
    </div>
  );
}
