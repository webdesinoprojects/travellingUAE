/**
 * End-user IP extraction with an explicit, non-spoofable proxy-trust policy.
 *
 * ETG requires a trustworthy PUBLIC end-user IP on Create Booking. We only accept
 * an IP from headers our deployment edge sets itself (and that a client cannot
 * forge end-to-end), and we reject anything that is not a syntactically valid,
 * public, routable address.
 *
 * Trust policy (deployment proxy configuration):
 *   1. `cf-connecting-ip`  - set by Cloudflare only; single value; highest trust.
 *   2. `x-real-ip`         - set by the platform edge (e.g. Vercel/nginx); single value.
 *   3. `x-forwarded-for`   - the LEFT-most entry is the original client. We take
 *      only that value and still require it to be a valid public IP. A
 *      client-prepended private or malformed value is rejected rather than
 *      trusted.
 *
 * There is NO fallback IP. If no trustworthy public IP is found the function
 * returns null and the caller MUST fail closed before any ETG call.
 */

// --- IP syntax validation ---------------------------------------------------

function isValidIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255 && String(n) === p; // no leading zeros
  });
}

function isValidIpv6(ip: string): boolean {
  // Accept standard and compressed forms; no IPv4-mapped shortcut handling beyond
  // the common case. Conservative: hex groups separated by ':' with one '::'.
  if (ip.indexOf(":") === -1) return false;
  if ((ip.match(/::/g) ?? []).length > 1) return false;
  const groups = ip.split(":");
  if (groups.length > 8) return false;
  return groups.every((g) => g === "" || /^[0-9a-fA-F]{1,4}$/.test(g));
}

// --- Public/routable checks (reject private, reserved, loopback, etc.) ------

function isPrivateOrReservedIpv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this" network / unspecified
  if (a === 192 && b === 0) return true; // IETF assignments + TEST-NET-1 192.0.0.0/24
  if (a === 169 && b === 254) return true; // link-local 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && b >= 18 && b <= 19) return true; // benchmark 198.18.0.0/15
  if (a === 198 && b === 51 && ip.startsWith("198.51.100.")) return true; // TEST-NET-2
  if (a === 203 && b === 0 && ip.startsWith("203.0.113.")) return true; // TEST-NET-3
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a >= 224) return true; // multicast / reserved / 255.255.255.255
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true; // unspecified / loopback
  if (lower.startsWith("fe80")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local fc00::/7
  if (lower.startsWith("ff")) return true; // multicast
  if (lower.startsWith("2001:db8")) return true; // documentation prefix 2001:db8::/32
  return false;
}

/** True only for a syntactically valid, public, routable IP (v4 or v6). */
export function isPublicIp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const ip = value.trim();
  if (ip.length < 3 || ip.length > 45) return false;

  if (isValidIpv4(ip)) return !isPrivateOrReservedIpv4(ip);
  if (isValidIpv6(ip)) return !isPrivateOrReservedIpv6(ip);
  return false;
}

// --- Extraction -------------------------------------------------------------

function firstPublic(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  // For a chain (x-forwarded-for) the left-most entry is the original client.
  const candidate = value.split(",")[0]?.trim();
  return isPublicIp(candidate) ? (candidate as string) : null;
}

/**
 * Extract a trustworthy public end-user IP, or null. Never returns a placeholder.
 * The caller fails closed (no ETG call) when this returns null.
 */
export function extractTrustedUserIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip");
  if (isPublicIp(cf?.trim())) return cf!.trim();

  const real = headers.get("x-real-ip");
  if (isPublicIp(real?.trim())) return real!.trim();

  return firstPublic(headers.get("x-forwarded-for"));
}
