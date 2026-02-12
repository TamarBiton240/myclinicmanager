
-- Simplify clients table: remove DOB and medical_notes
ALTER TABLE public.clients DROP COLUMN IF EXISTS date_of_birth;
ALTER TABLE public.clients DROP COLUMN IF EXISTS medical_notes;

-- Simplify appointments table: remove workflow columns no longer needed
ALTER TABLE public.appointments DROP COLUMN IF EXISTS is_completed;
ALTER TABLE public.appointments DROP COLUMN IF EXISTS is_summary_signed_off;
ALTER TABLE public.appointments DROP COLUMN IF EXISTS next_reminder_date;
ALTER TABLE public.appointments DROP COLUMN IF EXISTS duration_minutes;
ALTER TABLE public.appointments DROP COLUMN IF EXISTS notes;

-- Simplify treatment_areas: remove pain_level and notes
ALTER TABLE public.treatment_areas DROP COLUMN IF EXISTS pain_level;
ALTER TABLE public.treatment_areas DROP COLUMN IF EXISTS notes;

-- Make heat_level NOT NULL on treatment_areas
ALTER TABLE public.treatment_areas ALTER COLUMN heat_level SET NOT NULL;
