import { CreditCard } from "lucide-react";

export type ThreeDsRedirect = {
  actionUrl: string;
  method: "get" | "post";
  fields: Record<string, string>;
};

type Props = {
  threeDs: ThreeDsRedirect | null | undefined;
  buttonClassName?: string;
  className?: string;
  label?: string;
};

const REQUIRED_POST_FIELDS = ["MD", "PaReq", "TermUrl"] as const;

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function getThreeDsValidationError(threeDs: ThreeDsRedirect | null | undefined) {
  if (!threeDs) return "Card verification details are unavailable. Please try again.";
  if (!threeDs.actionUrl || !isHttpsUrl(threeDs.actionUrl)) {
    return "Card verification link is unavailable. Please contact support.";
  }
  if (threeDs.method === "post") {
    if (!threeDs.fields || typeof threeDs.fields !== "object") {
      return "Card verification details are incomplete. Please contact support.";
    }
    for (const fieldName of REQUIRED_POST_FIELDS) {
      const value = threeDs.fields[fieldName];
      if (typeof value !== "string" || value.length === 0) {
        return "Card verification details are incomplete. Please contact support.";
      }
    }
  }
  return null;
}

function ButtonContent({ label }: { label: string }) {
  return (
    <>
      <CreditCard aria-hidden="true" className="size-4" />
      {label}
    </>
  );
}

export function ThreeDsVerificationForm({
  threeDs,
  buttonClassName = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-navy px-5 text-sm font-extrabold text-white transition hover:bg-brand-blue dark:bg-brand-sand dark:text-brand-navy",
  className,
  label = "Complete card verification",
}: Props) {
  const validationError = getThreeDsValidationError(threeDs);

  if (validationError) {
    return (
      <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-200">
        {validationError}
      </p>
    );
  }

  const redirect = threeDs as ThreeDsRedirect;

  if (redirect.method === "get") {
    const link = (
      <a href={redirect.actionUrl} className={buttonClassName}>
        <ButtonContent label={label} />
      </a>
    );
    return className ? <div className={className}>{link}</div> : link;
  }

  return (
    <form method="post" action={redirect.actionUrl} className={className}>
      {Object.entries(redirect.fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} readOnly />
      ))}
      <button type="submit" className={buttonClassName}>
        <ButtonContent label={label} />
      </button>
    </form>
  );
}
