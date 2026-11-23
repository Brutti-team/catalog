-- Preserve the entered measurement unit separately for each overall size.
-- width/depth/height remain canonical centimetres, so historical values,
-- filters and validation keep their meaning.
ALTER TABLE public.products
 ADD COLUMN IF NOT EXISTS dimension_units jsonb NOT NULL
 DEFAULT '{"width":"cm","depth":"cm","height":"cm"}'::jsonb;

ALTER TABLE public.products
 ADD CONSTRAINT products_dimension_units_valid
 CHECK (
  jsonb_typeof(dimension_units) = 'object'
  AND coalesce((dimension_units->>'width' IN ('mm','cm','m','in','ft')),false)
  AND coalesce((dimension_units->>'depth' IN ('mm','cm','m','in','ft')),false)
  AND coalesce((dimension_units->>'height' IN ('mm','cm','m','in','ft')),false)
 );
