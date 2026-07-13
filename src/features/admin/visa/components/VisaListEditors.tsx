"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";

import type {
  VisaDocumentGroup,
  VisaFaq,
  VisaProcessStep,
  VisaTypeOption,
} from "@/data/visa";

/**
 * Repeatable list editors — replace the raw-JSON textareas so non-technical
 * staff add / edit / delete / reorder each item with plain form fields.
 */

// ---- Generic repeatable primitive -----------------------------------------

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function Repeatable<T>({
  items,
  onChange,
  makeEmpty,
  addLabel,
  itemLabel,
  renderItem,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  makeEmpty: () => T;
  addLabel: string;
  itemLabel: (index: number) => string;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => ReactNode;
}) {
  function update(index: number, patch: Partial<T>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  return (
    <div className="grid gap-3">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-soft p-4 text-center text-sm font-semibold text-brand-brown">
          None yet. Add one below.
        </p>
      ) : null}

      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-border-soft bg-surface-muted/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-[0.1em] text-brand-brown">{itemLabel(index)}</span>
            <div className="flex items-center gap-1">
              <IconBtn label="Move up" disabled={index === 0} onClick={() => onChange(move(items, index, index - 1))}>
                <ArrowUp className="size-3.5" aria-hidden="true" />
              </IconBtn>
              <IconBtn label="Move down" disabled={index === items.length - 1} onClick={() => onChange(move(items, index, index + 1))}>
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </IconBtn>
              <IconBtn label="Delete" onClick={() => onChange(items.filter((_, i) => i !== index))} danger>
                <Trash2 className="size-3.5" aria-hidden="true" />
              </IconBtn>
            </div>
          </div>
          {renderItem(item, (patch) => update(index, patch))}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, makeEmpty()])}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-brand-blue/50 bg-brand-blue/5 text-sm font-black text-brand-blue"
      >
        <Plus className="size-4" aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-8 place-items-center rounded-lg border border-border-soft bg-white disabled:opacity-40 dark:bg-white/10 ${
        danger ? "text-red-600 dark:text-red-400" : "text-brand-navy dark:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, value, onChange, textarea = false }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] font-black uppercase tracking-[0.08em] text-brand-brown">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full resize-y rounded-lg border border-border-soft bg-[#fffaf2] px-2.5 py-2 text-sm font-semibold outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-9 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-2.5 text-sm font-semibold outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white"
        />
      )}
    </label>
  );
}

// ---- Specific editors ------------------------------------------------------

export function VisaTypesEditor({ items, onChange }: { items: VisaTypeOption[]; onChange: (v: VisaTypeOption[]) => void }) {
  return (
    <Repeatable
      items={items}
      onChange={onChange}
      addLabel="Add visa type"
      itemLabel={(i) => `Visa type ${i + 1}`}
      makeEmpty={() => ({ title: "", processingTime: "", stayPeriod: "", validity: "", entry: "", fee: "", popular: false })}
      renderItem={(item, update) => (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Title" value={item.title} onChange={(v) => update({ title: v })} />
          <Field label="Fee" value={item.fee} onChange={(v) => update({ fee: v })} />
          <Field label="Processing time" value={item.processingTime} onChange={(v) => update({ processingTime: v })} />
          <Field label="Stay period" value={item.stayPeriod} onChange={(v) => update({ stayPeriod: v })} />
          <Field label="Validity" value={item.validity} onChange={(v) => update({ validity: v })} />
          <Field label="Entry" value={item.entry} onChange={(v) => update({ entry: v })} />
          <label className="inline-flex items-center gap-2 text-sm font-black sm:col-span-2">
            <input type="checkbox" checked={item.popular === true} onChange={(e) => update({ popular: e.target.checked })} className="size-4 accent-brand-blue" />
            Mark as popular
          </label>
        </div>
      )}
    />
  );
}

export function DocumentsEditor({ items, onChange }: { items: VisaDocumentGroup[]; onChange: (v: VisaDocumentGroup[]) => void }) {
  return (
    <Repeatable
      items={items}
      onChange={onChange}
      addLabel="Add document group"
      itemLabel={(i) => `Group ${i + 1}`}
      makeEmpty={() => ({ title: "", items: [""] })}
      renderItem={(item, update) => (
        <div className="grid gap-2">
          <Field label="Group title" value={item.title} onChange={(v) => update({ title: v })} />
          <StringList
            label="Documents"
            addLabel="Add document"
            items={item.items}
            onChange={(next) => update({ items: next })}
          />
        </div>
      )}
    />
  );
}

export function ProcessStepsEditor({ items, onChange }: { items: VisaProcessStep[]; onChange: (v: VisaProcessStep[]) => void }) {
  return (
    <Repeatable
      items={items}
      onChange={onChange}
      addLabel="Add step"
      itemLabel={(i) => `Step ${i + 1}`}
      makeEmpty={() => ({ title: "", description: "" })}
      renderItem={(item, update) => (
        <div className="grid gap-2">
          <Field label="Title" value={item.title} onChange={(v) => update({ title: v })} />
          <Field label="Description" value={item.description} onChange={(v) => update({ description: v })} textarea />
        </div>
      )}
    />
  );
}

export function FaqsEditor({ items, onChange }: { items: VisaFaq[]; onChange: (v: VisaFaq[]) => void }) {
  return (
    <Repeatable
      items={items}
      onChange={onChange}
      addLabel="Add FAQ"
      itemLabel={(i) => `FAQ ${i + 1}`}
      makeEmpty={() => ({ question: "", answer: "" })}
      renderItem={(item, update) => (
        <div className="grid gap-2">
          <Field label="Question" value={item.question} onChange={(v) => update({ question: v })} />
          <Field label="Answer" value={item.answer} onChange={(v) => update({ answer: v })} textarea />
        </div>
      )}
    />
  );
}

/** Reorderable list of single-line strings (Why choose + document items). */
export function StringList({
  label,
  addLabel,
  items,
  onChange,
}: {
  label: string;
  addLabel: string;
  items: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-[11px] font-black uppercase tracking-[0.08em] text-brand-brown">{label}</span>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={item}
            onChange={(e) => onChange(items.map((it, i) => (i === index ? e.target.value : it)))}
            className="min-h-9 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-2.5 text-sm font-semibold outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white"
          />
          <IconBtn label="Move up" disabled={index === 0} onClick={() => onChange(move(items, index, index - 1))}>
            <ArrowUp className="size-3.5" aria-hidden="true" />
          </IconBtn>
          <IconBtn label="Move down" disabled={index === items.length - 1} onClick={() => onChange(move(items, index, index + 1))}>
            <ArrowDown className="size-3.5" aria-hidden="true" />
          </IconBtn>
          <IconBtn label="Delete" danger onClick={() => onChange(items.filter((_, i) => i !== index))}>
            <Trash2 className="size-3.5" aria-hidden="true" />
          </IconBtn>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-blue/50 bg-brand-blue/5 text-xs font-black text-brand-blue"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  );
}

export { StringList as WhyChooseEditor };
