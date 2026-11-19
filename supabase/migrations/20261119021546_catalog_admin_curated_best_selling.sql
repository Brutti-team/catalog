-- Admin-maintained editorial Best Selling shelf, independent of Featured.
-- Reuses the existing products RLS policies; no policy or existing status changes.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS best_selling boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.best_selling IS
  'Admin-curated Best Selling showcase flag. Only published products are displayed publicly.';
