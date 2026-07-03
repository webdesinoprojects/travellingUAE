"use client";

import { Check, Eye, EyeOff, Loader2, Pencil, Star } from "lucide-react";
import { useState } from "react";

import { formatEsimMoney } from "@/features/admin/esim/format";
import type { AdminPlanItem } from "@/features/admin/esim/visibility-types";

import { FeaturedBadge, VisibilityBadge } from "./EsimVisibilityBits";
import { useControlSave } from "./use-control-save";

const PLANS_URL = "/api/admin/esim/plans";

export function EsimPlanRow({ plan }: { plan: AdminPlanItem }) {
  const { state, message, save } = useControlSave();
  const [open, setOpen] = useState(false);

  // Optimistic toggle state, reconciled with the server value after refresh via
  // the "adjust state during render" pattern (no effect, no cascading render).
  const [visible, setVisible] = useState(plan.isVisible);
  const [featured, setFeatured] = useState(plan.isFeatured);
  const [serverState, setServerState] = useState({
    visible: plan.isVisible,
    featured: plan.isFeatured,
  });
  if (serverState.visible !== plan.isVisible || serverState.featured !== plan.isFeatured) {
    setServerState({ visible: plan.isVisible, featured: plan.isFeatured });
    setVisible(plan.isVisible);
    setFeatured(plan.isFeatured);
  }

  const [sortOrder, setSortOrder] = useState(String(plan.sortOrder));
  const [disabledReason, setDisabledReason] = useState(plan.disabledReason ?? "");
  const [adminNote, setAdminNote] = useState(plan.adminNote ?? "");

  const busy = state === "saving";
  const identity = {
    countryCode: plan.countryCode,
    planCode: plan.planCode,
    planName: plan.planName,
  };

  async function toggleVisible() {
    const next = !visible;
    setVisible(next);
    const ok = await save(PLANS_URL, { ...identity, isVisible: next });
    if (!ok) setVisible(!next);
  }

  async function toggleFeatured() {
    const next = !featured;
    setFeatured(next);
    const ok = await save(PLANS_URL, { ...identity, isFeatured: next });
    if (!ok) setFeatured(!next);
  }

  function cancelEdit() {
    setSortOrder(String(plan.sortOrder));
    setDisabledReason(plan.disabledReason ?? "");
    setAdminNote(plan.adminNote ?? "");
    setOpen(false);
  }

  async function saveDetails() {
    const ok = await save(PLANS_URL, {
      ...identity,
      sortOrder: Number.parseInt(sortOrder, 10) || 0,
      disabledReason: disabledReason.trim() || null,
      adminNote: adminNote.trim() || null,
    });
    if (ok) setOpen(false);
  }

  return (
    <li className="rounded-lg border border-[#e4d6bf] bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-black">{plan.planName ?? plan.planCode}</p>
          <p className="truncate text-xs text-brand-brown">
            {plan.countryCode} · {plan.planCode} · {formatEsimMoney(plan.price, plan.currency)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <VisibilityBadge isVisible={visible} />
            <FeaturedBadge isFeatured={featured} />
            <span className="text-xs font-bold text-brand-brown">Sort {plan.sortOrder}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleVisible()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border-soft bg-white px-3 text-xs font-black text-brand-navy disabled:opacity-50 dark:bg-white/10 dark:text-white"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {visible ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleFeatured()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border-soft bg-white px-3 text-xs font-black text-brand-navy disabled:opacity-50 dark:bg-white/10 dark:text-white"
          >
            <Star className="size-4" />
            {featured ? "Unfeature" : "Feature"}
          </button>
          <button
            type="button"
            onClick={() => (open ? cancelEdit() : setOpen(true))}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border-soft bg-white px-3 text-xs font-black text-brand-navy dark:bg-white/10 dark:text-white"
            aria-expanded={open}
          >
            <Pencil className="size-4" />
            Edit
          </button>
        </div>
      </div>

      {plan.disabledReason || plan.adminNote ? (
        <p className="mt-3 line-clamp-2 text-xs font-semibold text-brand-brown">
          {plan.disabledReason ? `Reason: ${plan.disabledReason}. ` : ""}
          {plan.adminNote ? `Note: ${plan.adminNote}` : ""}
        </p>
      ) : null}

      {open ? (
        <div className="mt-4 grid gap-3 border-t border-[#efe3cf] pt-4 dark:border-white/10">
          <label className="grid gap-1.5 sm:max-w-40">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-brand-brown">Sort order</span>
            <input
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              inputMode="numeric"
              className={inputClass}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
              Disabled reason (internal)
            </span>
            <input
              value={disabledReason}
              onChange={(event) => setDisabledReason(event.target.value)}
              maxLength={300}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-brand-brown">
              Admin note (never shown to customers)
            </span>
            <textarea
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              maxLength={2000}
              rows={3}
              className={`${inputClass} resize-y`}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveDetails()}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-black text-white disabled:opacity-50 dark:bg-brand-sand dark:text-brand-navy"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : state === "saved" ? (
                <Check className="size-4" />
              ) : null}
              Save
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={cancelEdit}
              className="inline-flex min-h-11 items-center rounded-lg border border-border-soft bg-white px-5 text-sm font-black text-brand-navy disabled:opacity-50 dark:bg-white/10 dark:text-white"
            >
              Cancel
            </button>
            {message ? (
              <p className="text-sm font-bold text-red-600 dark:text-red-400">{message}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-sm font-semibold text-brand-navy outline-none focus:border-brand-blue dark:bg-white/10 dark:text-white";
