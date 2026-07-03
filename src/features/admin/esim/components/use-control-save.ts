"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type ControlSaveState = "idle" | "saving" | "saved" | "error";

/**
 * Shared client hook for admin visibility edits. PATCHes an admin-only route,
 * surfaces status, and refreshes the server-rendered list on success. The body
 * carries only the changed control fields — never sensitive data.
 */
export function useControlSave() {
  const router = useRouter();
  const [state, setState] = useState<ControlSaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function save(url: string, body: unknown): Promise<boolean> {
    setState("saving");
    setMessage(null);
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        setState("error");
        setMessage(payload?.message ?? "The change could not be saved.");
        return false;
      }

      setState("saved");
      router.refresh();
      window.setTimeout(() => setState("idle"), 1500);
      return true;
    } catch {
      setState("error");
      setMessage("A connection error occurred.");
      return false;
    }
  }

  return { state, message, save };
}
