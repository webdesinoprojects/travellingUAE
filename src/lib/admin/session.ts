export const ADMIN_SESSION_COOKIE = "flytime-admin-access";
export const ADMIN_REFRESH_COOKIE = "flytime-admin-refresh";
export const ADMIN_REMEMBER_COOKIE = "flytime-admin-remember";

export const ADMIN_ACCESS_MAX_AGE = 60 * 60;
export const ADMIN_REMEMBER_MAX_AGE = 60 * 60 * 24 * 30;

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    priority: "high" as const,
  };
}
