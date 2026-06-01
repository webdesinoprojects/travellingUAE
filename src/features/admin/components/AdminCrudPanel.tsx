"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, DatabaseZap, Loader2, Pencil, Trash2 } from "lucide-react";

type AdminCrudPanelProps = {
  resource: string;
  firstRowId?: string;
};

type CrudState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
  activeAction?: string;
  createdId?: string;
};

const CREATE_ENABLED = new Set([
  "bookings",
  "destinations",
  "trips",
  "categories",
  "media",
  "home",
  "pages",
  "navigation",
  "translations",
  "newsletter",
]);

const PATCH_ENABLED = new Set([...CREATE_ENABLED, "users"]);
const DELETE_ENABLED = new Set([
  "bookings",
  "destinations",
  "trips",
  "categories",
  "media",
  "home",
  "pages",
  "navigation",
  "translations",
  "newsletter",
]);

export function AdminCrudPanel({ resource, firstRowId }: AdminCrudPanelProps) {
  const [hasSession, setHasSession] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [state, setState] = useState<CrudState>({
    status: "idle",
    message: "Connect an admin session to run live create, update, and remove checks.",
  });
  const activeId = state.createdId ?? firstRowId;
  const canCreate = CREATE_ENABLED.has(resource);
  const canPatch = PATCH_ENABLED.has(resource) && Boolean(activeId);
  const canDelete = DELETE_ENABLED.has(resource) && Boolean(activeId);
  const isBusy = state.status === "loading";
  const authReady = hasSession;
  const helperText = useMemo(() => {
    if (!sessionChecked) {
      return "Checking admin session...";
    }

    if (!authReady) {
      return "Sign in with a Supabase admin/editor account to run mutations.";
    }

    return state.message;
  }, [authReady, sessionChecked, state.message]);

  useEffect(() => {
    let mounted = true;

    fetch("/api/admin/session", { method: "GET" })
      .then((response) => {
        if (!mounted) {
          return;
        }

        setHasSession(response.ok);
      })
      .catch(() => {
        if (mounted) {
          setHasSession(false);
        }
      })
      .finally(() => {
        if (mounted) {
          setSessionChecked(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function runAction(action: "create" | "update" | "delete") {
    if (!hasSession) {
      setState({
        status: "error",
        message: "Admin session is required for live writes.",
      });
      return;
    }

    const targetId = state.createdId ?? firstRowId;
    const method = action === "create" ? "POST" : action === "update" ? "PATCH" : "DELETE";
    const url =
      action === "create"
        ? `/api/admin/resources/${resource}`
        : `/api/admin/resources/${resource}/${targetId}`;
    const body =
      action === "delete" ? undefined : buildDemoPayload(resource, action);

    setState((current) => ({
      ...current,
      status: "loading",
      message: "Saving...",
      activeAction: action,
    }));

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; data?: { row?: { id?: string } }; message?: string }
        | null;

      if (!response.ok || payload?.ok !== true) {
        throw new Error("request-failed");
      }

      setState({
        status: "success",
        message:
          action === "create"
            ? "Record created and audit log written."
            : action === "update"
              ? "Record updated and audit log written."
              : "Record removed or archived and audit log written.",
        createdId: action === "create" ? payload.data?.row?.id : undefined,
      });
    } catch {
      setState({
        status: "error",
        message: "This action could not be completed. Check access and required fields.",
      });
    }
  }

  return (
    <section className="rounded-lg border border-[#d7c5ad] bg-white/78 p-4 shadow-[0_18px_50px_rgb(7_23_57/0.08)] dark:border-white/10 dark:bg-white/[0.06]">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-brown">
            Live admin API
          </p>
          <h2 className="mt-2 text-xl font-black">CRUD checks for {resource}</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-brand-brown">
            Actions call protected route handlers, validate input server-side,
            and record safe audit entries.
          </p>
          <div
            className={`mt-4 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-black ${
              state.status === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : state.status === "success"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-[#d7c5ad] bg-[#fffaf2] text-brand-brown"
            }`}
          >
            {state.status === "success" ? (
              <CheckCircle2 aria-hidden="true" className="size-4" />
            ) : (
              <DatabaseZap aria-hidden="true" className="size-4" />
            )}
            {helperText}
          </div>
        </div>

        <div className="grid gap-3 rounded-lg bg-[#e8f7ff] p-4 dark:bg-white/10">
          <button
            type="button"
            disabled={!authReady || !canCreate || isBusy}
            onClick={() => void runAction("create")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45 dark:bg-brand-sand dark:text-brand-navy"
          >
            {isBusy && state.activeAction === "create" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <DatabaseZap aria-hidden="true" className="size-4" />
            )}
            Create demo record
          </button>
          <button
            type="button"
            disabled={!authReady || !canPatch || isBusy}
            onClick={() => void runAction("update")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-blue/25 bg-white px-4 text-sm font-black text-brand-navy disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:bg-white/10 dark:text-white"
          >
            {isBusy && state.activeAction === "update" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Pencil aria-hidden="true" className="size-4" />
            )}
            Update active record
          </button>
          <button
            type="button"
            disabled={!authReady || !canDelete || isBusy}
            onClick={() => void runAction("delete")}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d7c5ad] bg-[#fffaf2] px-4 text-sm font-black text-brand-brown disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/15 dark:bg-white/10 dark:text-brand-sand"
          >
            {isBusy && state.activeAction === "delete" ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Trash2 aria-hidden="true" className="size-4" />
            )}
            Archive/remove active record
          </button>
        </div>
      </div>
    </section>
  );
}

function buildDemoPayload(resource: string, action: "create" | "update") {
  const stamp = Date.now().toString(36);
  const suffix = action === "create" ? stamp : "updated";

  if (resource === "destinations") {
    return {
      name: `Demo Destination ${suffix}`,
      slug: `demo-destination-${stamp}`,
      country: "United Arab Emirates",
      city: "Dubai",
      resultTitle: `Trips in Demo Destination ${suffix}`,
      currency: "SAR",
      status: "draft",
    };
  }

  if (resource === "trips") {
    return {
      destinationSlug: "armenia",
      title: `Demo City Break ${suffix}`,
      slug: `demo-city-break-${stamp}`,
      city: "Yerevan",
      summary: "Safe admin demo package used for API verification.",
      overview: "This record is created from the admin CRUD panel for route testing.",
      durationDays: 3,
      nights: 2,
      priceAmount: 2500,
      currency: "SAR",
      hasFlights: true,
      status: "draft",
    };
  }

  if (resource === "categories") {
    return {
      name: `Demo Category ${suffix}`,
      slug: `demo-category-${stamp}`,
      description: "Admin CRUD demo category.",
      status: "draft",
    };
  }

  if (resource === "media") {
    return {
      provider: "external",
      publicId: `admin/demo-${stamp}`,
      url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
      altText: `Demo admin media ${suffix}`,
      resourceType: "image",
      folder: "admin-demo",
      format: "jpg",
    };
  }

  if (resource === "home") {
    return {
      key: `admin-demo-section-${stamp}`,
      title: `Admin Demo Section ${suffix}`,
      eyebrow: "Demo",
      description: "Safe CMS demo section for admin route testing.",
      payload: { cards: [] },
      status: "draft",
    };
  }

  if (resource === "pages") {
    return {
      title: `Admin Demo Page ${suffix}`,
      slug: `admin-demo-page-${stamp}`,
      excerpt: "Safe admin demo page.",
      body: "This demo page verifies protected create, update, and archive routes.",
      status: "draft",
    };
  }

  if (resource === "navigation") {
    return {
      label: `Demo Link ${suffix}`,
      href: `/admin-demo-${stamp}`,
      location: "footer",
      status: "draft",
      sortOrder: 99,
    };
  }

  if (resource === "translations") {
    return {
      locale: "en",
      namespace: "admin-demo",
      key: `message.${stamp}`,
      value: `Admin demo translation ${suffix}`,
      status: "draft",
    };
  }

  if (resource === "newsletter") {
    return {
      email: `admin-demo-${stamp}@example.com`,
      locale: "en",
      source: "admin-demo",
      isActive: true,
    };
  }

  if (resource === "bookings") {
    return {
      fullName: `Demo Traveler ${suffix}`,
      email: `booking-demo-${stamp}@example.com`,
      phone: "+966500000000",
      travelersCount: 2,
      travelDate: "2026-05-27",
      status: "new",
    };
  }

  if (resource === "users") {
    return {
      fullName: `Admin User ${suffix}`,
      role: "editor",
      isActive: true,
    };
  }

  return {};
}
