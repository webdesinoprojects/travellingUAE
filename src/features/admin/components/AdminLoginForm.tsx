"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Loader2, Mail } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type LoginState = {
  status: "idle" | "loading" | "error";
  message: string;
};

export function AdminLoginForm() {
  const router = useRouter();
  const [state, setState] = useState<LoginState>({
    status: "idle",
    message: "",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      setState({
        status: "error",
        message: "Enter your admin email and password.",
      });
      return;
    }

    setState({ status: "loading", message: "Checking access..." });

    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session?.access_token) {
        throw new Error("invalid-login");
      }

      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: data.session.access_token }),
      });

      if (!response.ok) {
        await supabase.auth.signOut();
        throw new Error("session-rejected");
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setState({
        status: "error",
        message: "Admin access could not be verified.",
      });
    }
  }

  const isBusy = state.status === "loading";

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto grid w-full max-w-md gap-4 rounded-lg border border-[#d7c5ad] bg-white/88 p-5 shadow-[0_24px_70px_rgb(7_23_57/0.12)] dark:border-white/10 dark:bg-white/[0.06]"
    >
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-brown">
          Admin access
        </p>
        <h1 className="mt-2 font-serif text-3xl font-black tracking-tight">
          Sign in to Fly Time
        </h1>
      </div>

      <label className="grid gap-2 text-sm font-black">
        Email
        <span className="flex min-h-12 items-center gap-3 rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-brand-brown dark:bg-white/10">
          <Mail aria-hidden="true" className="size-4" />
          <input
            name="email"
            type="email"
            autoComplete="email"
            className="min-w-0 flex-1 bg-transparent text-brand-navy outline-none placeholder:text-brand-brown/70 dark:text-white"
            placeholder="admin@example.com"
            disabled={isBusy}
          />
        </span>
      </label>

      <label className="grid gap-2 text-sm font-black">
        Password
        <span className="flex min-h-12 items-center gap-3 rounded-lg border border-border-soft bg-[#fffaf2] px-3 text-brand-brown dark:bg-white/10">
          <LockKeyhole aria-hidden="true" className="size-4" />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            className="min-w-0 flex-1 bg-transparent text-brand-navy outline-none placeholder:text-brand-brown/70 dark:text-white"
            placeholder="Password"
            disabled={isBusy}
          />
        </span>
      </label>

      {state.status === "error" ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isBusy}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-brand-navy px-4 text-sm font-black text-white shadow-[0_14px_30px_rgb(7_23_57/0.22)] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-sand dark:text-brand-navy"
      >
        {isBusy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
        Sign in
      </button>
    </form>
  );
}
