/**
 * Pure display helpers for Airhub plans.
 *
 * Dependency-free (node --test friendly): no server-only, no DOM APIs. Airhub's
 * `additionalInfo` field is raw provider HTML (e.g.
 * `<p>Package Details:<br />&nbsp;</p><ul><li>...</li></ul>`). This module turns
 * it into safe, structured plain text/bullets for React to render as text nodes
 * — never via dangerouslySetInnerHTML, so no markup can ever execute or leak
 * through untouched.
 *
 * Feature extraction only ever surfaces fields that are ACTUALLY present on the
 * confirmed Airhub plan contract (see contracts.ts AirhubPublicPlan). Nothing
 * here invents a plan category, network generation, APN, or compatibility claim
 * that isn't backed by a real field — those only ever appear inside the cleaned
 * description text, verbatim from the provider.
 */

import type { AirhubPublicPlan } from "./contracts";

export type AirhubDescriptionSection = {
  /** Section heading (e.g. "Package Details", "Supported Countries"), or null for a lead-in paragraph with no heading. */
  heading: string | null;
  /** Bullet lines under this heading (from <li>), already decoded/stripped of tags. */
  items: string[];
};

export type SanitizedAirhubDescription = {
  /** Fully flattened, readable plain text (paragraphs/bullets joined by newlines). Safe to render as text. */
  plainText: string;
  /** Structured heading -> bullet groups, when the source used <ul>/<li>. */
  sections: AirhubDescriptionSection[];
  /** All bullet lines across every section, flattened (handy for a short summary). */
  bullets: string[];
};

const EMPTY_DESCRIPTION: SanitizedAirhubDescription = {
  plainText: "",
  sections: [],
  bullets: [],
};

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/** Decode the small set of HTML entities Airhub actually uses. Never throws. */
function decodeEntities(value: string): string {
  return value.replace(/&(?:nbsp|amp|lt|gt|quot|#39|apos);/g, (match) => HTML_ENTITIES[match] ?? match);
}

/** Strip ALL tags from a fragment, leaving plain decoded text. Defensive: never throws. */
function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse Airhub's `additionalInfo` HTML into safe plain text + structured
 * sections. Handles the two real shapes seen across countries:
 *   - `<p>Heading:</p><ul><li>...</li></ul>` (heading in its own <p>)
 *   - `<p><strong>Heading:</strong></p><ul><li>...</li></ul>` (bold heading)
 *   - a lone `<ul><li>...</li></ul>` with no heading (UK "Calls" plans)
 * Never throws on malformed/unexpected markup; worst case it falls back to a
 * single unheaded section (or plain text) from whatever it can strip.
 */
export function sanitizeAirhubDescription(raw: string | null | undefined): SanitizedAirhubDescription {
  if (!raw || typeof raw !== "string") return EMPTY_DESCRIPTION;
  const html = raw.trim();
  if (!html) return EMPTY_DESCRIPTION;

  const sections: AirhubDescriptionSection[] = [];
  // Split on <ul>...</ul> blocks, keeping the text that precedes each as a
  // candidate heading for that block.
  const ulPattern = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let matchedAny = false;

  while ((match = ulPattern.exec(html)) !== null) {
    matchedAny = true;
    const precedingHtml = html.slice(lastIndex, match.index);
    const heading = extractHeading(precedingHtml);
    const items = extractListItems(match[1]);
    if (items.length > 0) {
      sections.push({ heading, items });
    }
    lastIndex = ulPattern.lastIndex;
  }

  if (!matchedAny) {
    // No list markup at all: treat the whole thing as plain text.
    const text = stripTags(html);
    return text ? { plainText: text, sections: [], bullets: [] } : EMPTY_DESCRIPTION;
  }

  // Any trailing content after the last </ul> that isn't just whitespace/tags.
  const trailing = stripTags(html.slice(lastIndex));
  if (trailing) {
    sections.push({ heading: null, items: [trailing] });
  }

  const bullets = sections.flatMap((section) => section.items);
  const plainText = sections
    .map((section) => (section.heading ? `${section.heading}: ${section.items.join("; ")}` : section.items.join("; ")))
    .join(" ")
    .trim();

  return { plainText, sections, bullets };
}

function extractHeading(precedingHtml: string): string | null {
  const text = stripTags(precedingHtml);
  if (!text) return null;
  // Headings are short labels like "Package Details:" - drop a trailing colon.
  return text.replace(/:\s*$/, "").trim() || null;
}

function extractListItems(listInnerHtml: string): string[] {
  const items: string[] = [];
  const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;
  while ((match = liPattern.exec(listInnerHtml)) !== null) {
    const text = stripTags(match[1]);
    if (text) items.push(text);
  }
  return items;
}

// ---- Feature extraction: real fields only ---------------------------------

export type PlanFeatureView = {
  /** planType as returned (e.g. "Local"). Airhub does not return a "Premium/Standard/Lifetime" tier field. */
  coverage: string | null;
  operator: string | null;
  /** Human label like "4 GB", derived from capacity (+dataUnit if present, else the unit found in planName). */
  dataLabel: string | null;
  /** Human label like "30 Days", derived from validityType/validity (+ planName fallback). */
  validityLabel: string | null;
  /** Only set when Airhub's `phoneNumber` boolean is present; null means unknown (never guessed). */
  includesCalls: boolean | null;
  /** Only set when Airhub's `subscription` boolean is present. */
  renewalAvailable: boolean | null;
  travelDateRequirement: string | null;
  countriesCovered: string | null;
  planCode: string;
  description: SanitizedAirhubDescription;
};

export function extractPlanFeatures(plan: AirhubPublicPlan): PlanFeatureView {
  return {
    coverage: nonEmpty(plan.planType),
    operator: nonEmpty(plan.networkOperator),
    dataLabel: deriveDataLabel(plan),
    validityLabel: deriveValidityLabel(plan),
    includesCalls: typeof plan.phoneNumber === "boolean" ? plan.phoneNumber : null,
    renewalAvailable: typeof plan.subscription === "boolean" ? plan.subscription : null,
    travelDateRequirement: nonEmpty(plan.travelDateRequirement),
    countriesCovered: nonEmpty(plan.countriesCovered),
    planCode: plan.planCode,
    description: sanitizeAirhubDescription(plan.additionalInfo),
  };
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Data amount label. `capacity` is a real field; `dataUnit` (also real) is
 * almost always empty in the live payload, so as a display-only fallback we
 * confirm the unit against the plan's own `planName` (e.g. "Azerbaijan 4GB
 * 30days" for capacity "4") rather than hardcoding GB. If nothing confirms a
 * unit, the bare capacity number is shown without inventing one.
 */
function deriveDataLabel(plan: AirhubPublicPlan): string | null {
  const capacity = nonEmpty(plan.capacity);
  if (!capacity) return null;

  const unit = nonEmpty(plan.dataUnit) ?? confirmUnitFromText(capacity, plan.planName);
  return unit ? `${capacity} ${unit}` : capacity;
}

function confirmUnitFromText(capacity: string, text: string | null): string | null {
  if (!text) return null;
  const escaped = capacity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*(gb|mb|tb)`, "i").exec(text);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Validity label. `validityType` is a real field (e.g. "Days") but the
 * matching numeric `validity` field is consistently empty in the live payload;
 * the day count is only visible in the plan's own `planName` (e.g. "30days").
 * We read it from there rather than inventing a number.
 */
function deriveValidityLabel(plan: AirhubPublicPlan): string | null {
  const validity = nonEmpty(plan.validity);
  const validityType = nonEmpty(plan.validityType);
  if (validity && validityType) return `${validity} ${validityType}`;
  if (validity) return validity;

  const fromName = validityType ? confirmCountFromText(validityType, plan.planName) : null;
  if (fromName && validityType) return `${fromName} ${validityType}`;
  return validityType;
}

function confirmCountFromText(unitWord: string, text: string | null): string | null {
  if (!text) return null;
  const escaped = unitWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(\\d+)\\s*${escaped}`, "i").exec(text);
  return match ? match[1] : null;
}
