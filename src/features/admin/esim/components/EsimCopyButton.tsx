"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type EsimCopyButtonProps = {
  value: string;
  label: string;
};

/**
 * Small copy-to-clipboard button with transient "Copied" feedback. Only copies
 * the exact non-sensitive `value` it is given (e.g. a public reference or a
 * Stripe session id); it never receives activation/LPA/QR data.
 */
export function EsimCopyButton({ value, label }: EsimCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (permissions/insecure context). Fail silently;
      // the value is still visible on screen for manual copy.
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border-soft bg-white px-4 text-sm font-black text-brand-navy transition hover:bg-[#fffaf2] disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/[0.14]"
      aria-live="polite"
    >
      {copied ? (
        <Check aria-hidden="true" className="size-4 text-brand-blue dark:text-brand-sand" />
      ) : (
        <Copy aria-hidden="true" className="size-4" />
      )}
      <span className="truncate">{copied ? "Copied" : label}</span>
    </button>
  );
}
