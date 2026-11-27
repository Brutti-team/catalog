export type RouteLocation = { pathname: string; hash: string; hostname?: string; search?: string };

export const PUBLIC_CATALOG_ORIGIN = "https://catalog.brutti.my";
export const ADMIN_CATALOG_ORIGIN = "https://admincatalog.brutti.my";

function currentLocation(): RouteLocation {
  return typeof window === "undefined" ? { pathname: "/", hash: "" } : window.location;
}

/** GitHub Pages retains fragment routing; Pages/custom domains use real paths. */
export function usesPathRouting(location: RouteLocation = currentLocation()): boolean {
  return location.hostname === "catalog.brutti.my" || location.hostname === "admincatalog.brutti.my" ||
    Boolean(location.hostname?.endsWith(".pages.dev"));
}

/** Read routing without changing a fragment that Supabase may still need. */
export function resolveAppRoute(location: RouteLocation): string {
  if (location.hash.startsWith("#/")) return location.hash;
  if (usesPathRouting(location)) {
    const path = location.pathname.replace(/\/$/, "");
    if (/^\/(?:catalog\/)?product\//.test(path)) return `#${path}`;
    if (/^\/admin(?:\/index\.html)?$/.test(path)) return "#/admin";
    if (/^\/catalog(?:\/index\.html)?$/.test(path)) return "#/catalog";
    return location.hostname === "admincatalog.brutti.my" ? "#/admin" : "#/catalog";
  }
  return /\/catalog(?:\/index\.html)?\/?$/.test(location.pathname)
    ? "#/catalog"
    : "#/admin";
}

/** A visitor of the legacy deployment stays there until choosing a new domain. */
export function routeHref(route: string, location: RouteLocation = currentLocation()): string {
  const hash = route.startsWith("#") ? route : `#${route}`;
  if (!usesPathRouting(location)) return hash;
  const admin = hash === "#/admin";
  const product = hash.match(/^#\/(?:catalog\/)?product\/([^/?#]+)$/);
  const path = product ? `/product/${product[1]}` : "/";
  if (location.hostname === "catalog.brutti.my" && admin) return `${ADMIN_CATALOG_ORIGIN}/`;
  if (location.hostname === "admincatalog.brutti.my" && !admin) return `${PUBLIC_CATALOG_ORIGIN}${path}`;
  return location.hostname?.endsWith(".pages.dev") && admin ? "/admin" : path;
}

export function productIdFromLocation(location: RouteLocation): string | null {
  return productIdFromHash(resolveAppRoute(location));
}

export function subscribeRouteChange(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
  };
}

export function navigateApp(route: string, replace = false): void {
  const href = routeHref(route);
  if (href.startsWith("#")) {
    if (replace) window.history.replaceState(null, "", href);
    else window.location.hash = href;
  } else if (href.startsWith("https://")) {
    if (replace) window.location.replace(href);
    else window.location.assign(href);
    return;
  } else {
    window.history[replace ? "replaceState" : "pushState"](null, "", href + window.location.search);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/** Convert only app fragments. Supabase callback tokens remain for its SDK. */
export function installDomainRouting(): void {
  if (!usesPathRouting()) return;
  const normalize = () => {
    const location = window.location;
    if (location.hash.startsWith("#/")) navigateApp(location.hash, true);
    else if (!location.hash) {
      const route = resolveAppRoute(location);
      const href = routeHref(route);
      if (href.startsWith("https://") ||
        (/^\/(?:catalog|admin)(?:\/index\.html)?\/?$/.test(location.pathname) && href !== location.pathname)) {
        navigateApp(route, true);
      }
    }
  };
  normalize();
  window.addEventListener("hashchange", normalize);
  // External links, downloads, quick-view handlers, section anchors and
  // modified clicks keep their normal browser behaviour.
  document.addEventListener("click", event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || url.hash || !/^\/(?:admin\/?|product\/[^/]+\/?|)$/.test(url.pathname)) return;
    event.preventDefault();
    window.history.pushState(null, "", url.pathname + url.search);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

/** Product hashes work beneath either static entry, including legacy links. */
export function productIdFromHash(hash: string): string | null {
  const match = hash.match(/^#\/(?:catalog\/)?product\/([^/?#]+)$/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
}
