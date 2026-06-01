import { type NextRequest, NextResponse } from "next/server";

import {
  getPublicLocales,
  LOCALE_COOKIE_NAME,
  resolvePublicLocale,
} from "@/server/public/translations";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function GET(request: NextRequest) {
  const locales = await getPublicLocales();
  const requestedLocale = request.nextUrl.searchParams.get("locale");
  const returnTo = getSafeReturnPath(
    request.nextUrl.searchParams.get("returnTo"),
  );
  const locale = resolvePublicLocale(locales, requestedLocale);
  const response = NextResponse.redirect(new URL(returnTo, request.url));

  response.cookies.set({
    name: LOCALE_COOKIE_NAME,
    value: locale.code,
    httpOnly: true,
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

function getSafeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value.slice(0, 500);
}
