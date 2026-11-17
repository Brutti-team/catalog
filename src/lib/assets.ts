/** Resolve bundled public assets when hosted under a GitHub Pages subdirectory. */
export function publicAssetUrl(source?: string): string {
  const url = source || "/images/placeholder.svg";
  // Keep remote Supabase images, data URLs and blob previews untouched.
  // Both images/ and reference/ are bundled in Vite's public/ directory.
  // On GitHub Pages they MUST be prefixed by the deployed site base path.
  if (!url.startsWith("/images/") && !url.startsWith("/reference/")) return url;
  return `${import.meta.env.BASE_URL}${url.slice(1)}`;
}
