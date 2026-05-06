"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Theme = "light" | "dark";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>;
  };
};

function storedTheme(): Theme | null {
  if (typeof window === "undefined") {
    return null;
  }

  const theme = window.localStorage.getItem("flytime-theme");
  return theme === "dark" || theme === "light" ? theme : null;
}

function systemTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem("flytime-theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => storedTheme() ?? systemTheme());
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    const transitionDocument = document as ViewTransitionDocument;

    if (!transitionDocument.startViewTransition) {
      setTheme(nextTheme);
      applyTheme(nextTheme);
      return;
    }

    const transition = transitionDocument.startViewTransition(() => {
      setTheme(nextTheme);
      applyTheme(nextTheme);
    });

    void transition.ready.then(() => {
      const rect = buttonRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 420,
          easing: "cubic-bezier(.2,.8,.2,1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    });
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      suppressHydrationWarning
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      onClick={toggleTheme}
      className="relative grid size-10 overflow-hidden rounded-lg border border-border-soft bg-surface text-brand-navy shadow-sm transition hover:border-brand-blue hover:bg-brand-sky/70 dark:bg-white/[0.08] dark:text-white dark:hover:border-brand-sand"
    >
      <Sun
        className={[
          "absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 transition duration-300",
          theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
        ].join(" ")}
        aria-hidden="true"
      />
      <Moon
        className={[
          "absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 transition duration-300",
          theme === "dark" ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
        ].join(" ")}
        aria-hidden="true"
      />
    </button>
  );
}
