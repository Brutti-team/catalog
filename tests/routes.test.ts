import { expect, it } from "vitest";
import { productIdFromHash, productIdFromLocation, resolveAppRoute, routeHref } from "../src/lib/routes";

it.each(["/", "/index.html", "/brutti-catalog/", "/brutti-catalog/index.html"])(
  "preserves the existing admin default at %s",
  (pathname) => expect(resolveAppRoute({ pathname, hash: "" })).toBe("#/admin"),
);

it.each([
  "/catalog",
  "/catalog/",
  "/catalog/index.html",
  "/brutti-catalog/catalog/",
])("opens the public catalog directly at %s", (pathname) =>
  expect(resolveAppRoute({ pathname, hash: "" })).toBe("#/catalog"),
);

it.each(["/admin", "/admin/", "/admin/index.html", "/brutti-catalog/admin/"])(
  "opens the admin entry directly at %s",
  (pathname) => expect(resolveAppRoute({ pathname, hash: "" })).toBe("#/admin"),
);

it.each([
  "#/admin",
  "#/catalog",
  "#/product/table%20one",
  "#/catalog/product/table%20one",
])("lets an existing hash route override the static entry path: %s", (hash) =>
  expect(resolveAppRoute({ pathname: "/admin/", hash })).toBe(hash),
);

it.each(["invite", "recovery"])(
  "does not replace or consume a Supabase %s callback fragment",
  (type) => {
    const location = {
      pathname: "/admin/",
      hash: `#access_token=callback-token&refresh_token=callback-refresh&type=${type}`,
    };
    const original = { ...location };
    expect(resolveAppRoute(location)).toBe("#/admin");
    expect(location).toEqual(original);
  },
);

it.each(["#/product/table%20one", "#/catalog/product/table%20one"])(
  "decodes the product ID for both supported detail hashes: %s",
  (hash) => expect(productIdFromHash(hash)).toBe("table one"),
);

it.each([
  "",
  "#/admin",
  "#/catalog",
  "#/product/one/extra",
  "#/product/one?query=1",
  "#access_token=mock&type=invite",
])("does not treat non-product fragments as detail links: %s", (hash) =>
  expect(productIdFromHash(hash)).toBeNull(),
);

it("keeps malformed product IDs distinguishable from the collection route", () => {
  expect(productIdFromHash("#/product/%E0%A4%A")).toBe("");
});

it.each([
  ["catalog.brutti.my", "/", "#/catalog"],
  ["admincatalog.brutti.my", "/", "#/admin"],
  ["brutti-catalog.pages.dev", "/", "#/catalog"],
  ["preview.brutti-catalog.pages.dev", "/admin", "#/admin"],
  ["catalog.brutti.my", "/product/table%20one", "#/product/table%20one"],
])("routes %s%s without requiring an app fragment", (hostname, pathname, expected) => {
  expect(resolveAppRoute({ hostname, pathname, hash: "" })).toBe(expected);
});

it.each([
  ["catalog.brutti.my", "/catalog", "/"],
  ["catalog.brutti.my", "/admin", "https://admincatalog.brutti.my/"],
  ["admincatalog.brutti.my", "/admin", "/"],
  ["admincatalog.brutti.my", "/catalog", "https://catalog.brutti.my/"],
  ["catalog.brutti.my", "#/product/table%20one", "/product/table%20one"],
  ["admincatalog.brutti.my", "/product/table%20one", "https://catalog.brutti.my/product/table%20one"],
  ["preview.brutti-catalog.pages.dev", "/admin", "/admin"],
  ["brutti-team.github.io", "/admin", "#/admin"],
  ["brutti-team.github.io", "/catalog", "#/catalog"],
  ["brutti-team.github.io", "/product/table%20one", "#/product/table%20one"],
  ["catalog.brutti.my.evil.test", "/catalog", "#/catalog"],
])("builds links for %s: %s", (hostname, route, expected) => {
  expect(routeHref(route, { hostname, pathname: "/", hash: "" })).toBe(expected);
});

it("reads direct product paths on custom domains while keeping Supabase tokens untouched", () => {
  const productLocation = { hostname: "catalog.brutti.my", pathname: "/product/table%20one", hash: "" };
  expect(productIdFromLocation(productLocation)).toBe("table one");
  const callback = { hostname: "admincatalog.brutti.my", pathname: "/", hash: "#access_token=callback&refresh_token=refresh&type=invite" };
  expect(resolveAppRoute(callback)).toBe("#/admin");
  expect(callback.hash).toContain("access_token=callback");
});
