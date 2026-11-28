import { useState } from "react";

export type AdminTheme = "light" | "dark";
export const ADMIN_THEME_KEY = "brutti-catalog-admin-theme";

function initialTheme(): AdminTheme {
  try {
    const saved = window.localStorage.getItem(ADMIN_THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* Private browsing can disable preference storage. */ }
  return "light";
}

/** A browser preference only; public pages and account permissions are untouched. */
export function useAdminTheme() {
  const [theme, setTheme] = useState<AdminTheme>(initialTheme);
  function applyTheme(next: AdminTheme) {
    setTheme(next);
    try { window.localStorage.setItem(ADMIN_THEME_KEY, next); }
    catch { /* The selected mode still works for this session. */ }
  }
  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }
  function resetToLight() {
    applyTheme("light");
  }
  return { theme, toggleTheme, resetToLight };
}
