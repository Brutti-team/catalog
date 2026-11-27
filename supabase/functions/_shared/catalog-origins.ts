export const LEGACY_CATALOG_ORIGIN = "https://brutti-team.github.io";
export const STAFF_CATALOG_ORIGIN = "https://admincatalog.brutti.my";
export const CATALOG_STAFF_ORIGINS = [LEGACY_CATALOG_ORIGIN, STAFF_CATALOG_ORIGIN];

export function catalogStaffOriginAllowed(origin: string | null): boolean {
  // Requests without an Origin still require the existing server-side auth.
  return !origin || CATALOG_STAFF_ORIGINS.includes(origin);
}

export function catalogInvitationRedirect(origin: string | null): string {
  return origin === STAFF_CATALOG_ORIGIN
    ? `${STAFF_CATALOG_ORIGIN}/`
    : `${LEGACY_CATALOG_ORIGIN}/catalog/`;
}

export function catalogInvitationHeaders(origin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin && catalogStaffOriginAllowed(origin) ? origin : LEGACY_CATALOG_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  };
}
