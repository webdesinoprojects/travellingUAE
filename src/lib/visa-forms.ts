/**
 * Visa CMS form configuration: types, safe defaults, and defensive parsers.
 *
 * Pure and dependency-free (node --test friendly). These configs live in
 * `visa_destinations.metadata` (applyForm / callForm / contactCards) — no schema
 * change. The public forms render from the CMS config when present and fall back
 * to these defaults (which mirror the current hardcoded forms) otherwise.
 */

export type VisaFormFieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "select"
  | "textarea"
  | "date";

export const VISA_FIELD_TYPES: VisaFormFieldType[] = [
  "text",
  "email",
  "tel",
  "number",
  "select",
  "textarea",
  "date",
];

export type VisaFormFieldConfig = {
  key: string;
  label: string;
  type: VisaFormFieldType;
  required: boolean;
  enabled: boolean;
  placeholder?: string;
  min?: number;
  options?: string[];
  /** Populate a select from the destination's visa types. */
  optionsFromVisaTypes?: boolean;
  /** True for admin-added fields (deletable in the editor). */
  custom?: boolean;
};

export type VisaApplyFormConfig = {
  enabled: boolean;
  heading: string;
  helperText: string;
  submitLabel: string;
  defaultTravellers: number;
  fields: VisaFormFieldConfig[];
};

export type VisaCallFormConfig = {
  enabled: boolean;
  heading: string;
  submitLabel: string;
  fields: VisaFormFieldConfig[];
};

export type VisaContactCardConfig = { enabled: boolean; label: string; value: string };

export type VisaContactCardsConfig = {
  helperText: string;
  whatsapp: VisaContactCardConfig;
  phone: VisaContactCardConfig;
  timing: VisaContactCardConfig;
};

// ---- Defaults (mirror the current hardcoded public forms) ------------------

export function defaultApplyFormConfig(): VisaApplyFormConfig {
  return {
    enabled: true,
    heading: "Apply Online",
    helperText: "It takes less than 2 minutes to apply.",
    submitLabel: "Apply now",
    defaultTravellers: 1,
    fields: [
      { key: "email", label: "Email ID", type: "email", required: true, enabled: true, placeholder: "name@example.com" },
      { key: "phone", label: "Contact No", type: "tel", required: true, enabled: true, placeholder: "Contact number" },
      { key: "visaType", label: "Visa type", type: "select", required: true, enabled: true, optionsFromVisaTypes: true },
      { key: "travelers", label: "Travellers", type: "number", required: true, enabled: true, min: 1 },
    ],
  };
}

export function defaultCallFormConfig(): VisaCallFormConfig {
  return {
    enabled: true,
    heading: "Let us Call You",
    submitLabel: "Submit",
    fields: [
      { key: "fullName", label: "Name", type: "text", required: true, enabled: true, placeholder: "Your name" },
      { key: "email", label: "Email Id", type: "email", required: false, enabled: true, placeholder: "name@example.com" },
      { key: "phone", label: "Contact Number", type: "tel", required: true, enabled: true, placeholder: "Contact number" },
    ],
  };
}

export function defaultContactCardsConfig(): VisaContactCardsConfig {
  return {
    helperText: "It takes less than 2 minutes to apply.",
    whatsapp: { enabled: true, label: "Visa on WhatsApp", value: "+91 8879008992" },
    phone: { enabled: true, label: "Call us on", value: "02240666444" },
    timing: { enabled: true, label: "Timing", value: "9am to 9pm" },
  };
}

// ---- Defensive parsers (metadata -> config; bad shapes -> undefined) --------

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function isFieldType(value: unknown): value is VisaFormFieldType {
  return typeof value === "string" && (VISA_FIELD_TYPES as string[]).includes(value);
}

function keyify(value: unknown, index: number): string {
  const raw = typeof value === "string" ? value.trim() : "";
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 40);
  return cleaned || `field_${index}`;
}

export function parseFormFields(raw: unknown): VisaFormFieldConfig[] {
  if (!Array.isArray(raw)) return [];
  const out: VisaFormFieldConfig[] = [];
  raw.forEach((entry, i) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
    const r = entry as Record<string, unknown>;
    const type = isFieldType(r.type) ? r.type : "text";
    const label = str(r.label).slice(0, 80);
    const field: VisaFormFieldConfig = {
      key: keyify(r.key ?? label, i),
      label: label || "Field",
      type,
      required: bool(r.required, false),
      enabled: bool(r.enabled, true),
      custom: bool(r.custom, false),
    };
    const placeholder = str(r.placeholder).slice(0, 120);
    if (placeholder) field.placeholder = placeholder;
    if (typeof r.min === "number" && Number.isFinite(r.min)) field.min = r.min;
    if (r.optionsFromVisaTypes === true) field.optionsFromVisaTypes = true;
    if (Array.isArray(r.options)) {
      const options = r.options.filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim().slice(0, 120));
      if (options.length > 0) field.options = options;
    }
    out.push(field);
  });
  return out;
}

export function parseApplyFormConfig(raw: unknown): VisaApplyFormConfig | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const d = defaultApplyFormConfig();
  const fields = parseFormFields(r.fields);
  return {
    enabled: bool(r.enabled, true),
    heading: str(r.heading, d.heading).slice(0, 120),
    helperText: str(r.helperText, d.helperText).slice(0, 240),
    submitLabel: str(r.submitLabel, d.submitLabel).slice(0, 60),
    defaultTravellers: Math.max(1, Math.min(50, Math.round(num(r.defaultTravellers, 1)))),
    fields: fields.length > 0 ? fields : d.fields,
  };
}

export function parseCallFormConfig(raw: unknown): VisaCallFormConfig | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const d = defaultCallFormConfig();
  const fields = parseFormFields(r.fields);
  return {
    enabled: bool(r.enabled, true),
    heading: str(r.heading, d.heading).slice(0, 120),
    submitLabel: str(r.submitLabel, d.submitLabel).slice(0, 60),
    fields: fields.length > 0 ? fields : d.fields,
  };
}

function parseCard(raw: unknown, fallback: VisaContactCardConfig): VisaContactCardConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const r = raw as Record<string, unknown>;
  return {
    enabled: bool(r.enabled, fallback.enabled),
    label: str(r.label, fallback.label).slice(0, 80),
    value: str(r.value, fallback.value).slice(0, 80),
  };
}

export function parseContactCardsConfig(raw: unknown): VisaContactCardsConfig | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const d = defaultContactCardsConfig();
  return {
    helperText: str(r.helperText, d.helperText).slice(0, 240),
    whatsapp: parseCard(r.whatsapp, d.whatsapp),
    phone: parseCard(r.phone, d.phone),
    timing: parseCard(r.timing, d.timing),
  };
}

// ---- Public form resolution + submission helpers ---------------------------

/** Build the readable "Label: value" lines for an enquiry message from a form. */
export function buildEnquiryFieldLines(
  fields: VisaFormFieldConfig[],
  values: Record<string, string>,
): string[] {
  const lines: string[] = [];
  for (const field of fields) {
    if (!field.enabled) continue;
    const value = (values[field.key] ?? "").trim();
    if (!value) continue;
    lines.push(`${field.label}: ${value}`);
  }
  return lines;
}
