
-- 1. Add color and is_active to profiles (for staff display)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2. Add color to body_areas_config
ALTER TABLE public.body_areas_config ADD COLUMN IF NOT EXISTS color text DEFAULT '#94a3b8';

-- 3. Create treatment_plans table
CREATE TABLE public.treatment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  treatment_type public.treatment_type NOT NULL,
  price numeric DEFAULT 0,
  color text DEFAULT '#6366f1',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view plans" ON public.treatment_plans FOR SELECT USING (true);
CREATE POLICY "Admins can manage plans" ON public.treatment_plans FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Treatment plan <-> areas junction
CREATE TABLE public.treatment_plan_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  area_id uuid NOT NULL REFERENCES public.body_areas_config(id) ON DELETE CASCADE,
  UNIQUE(plan_id, area_id)
);

ALTER TABLE public.treatment_plan_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view plan areas" ON public.treatment_plan_areas FOR SELECT USING (true);
CREATE POLICY "Admins can manage plan areas" ON public.treatment_plan_areas FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Client plans - which plans assigned to which client, with custom area selection
CREATE TABLE public.client_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own client plans" ON public.client_plans FOR SELECT USING (
  EXISTS (SELECT 1 FROM clients WHERE clients.id = client_plans.client_id AND clients.user_id = auth.uid())
);
CREATE POLICY "Users can manage own client plans" ON public.client_plans FOR ALL USING (
  EXISTS (SELECT 1 FROM clients WHERE clients.id = client_plans.client_id AND clients.user_id = auth.uid())
);
CREATE POLICY "Staff can view assigned client plans" ON public.client_plans FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM appointments a 
    WHERE a.client_id = client_plans.client_id AND a.staff_member_id = auth.uid()
  )
);

-- 6. Add notes to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- 7. Restructure appointments
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS status text DEFAULT 'open' CHECK (status IN ('open', 'closed'));
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.treatment_plans(id);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reminder_requested boolean DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reminder_date timestamptz;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_amount numeric DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- Update payment_status enum to include 'partial'
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'partial';

-- 8. Add pain_level and treatment_number to treatment_areas
ALTER TABLE public.treatment_areas ADD COLUMN IF NOT EXISTS pain_level numeric DEFAULT 0;
ALTER TABLE public.treatment_areas ADD COLUMN IF NOT EXISTS treatment_number integer DEFAULT 1;

-- 9. Insert admin PIN setting if not exists
INSERT INTO public.clinic_settings (setting_key, setting_value)
VALUES ('admin_pin', '"1234"')
ON CONFLICT DO NOTHING;

-- Triggers for updated_at
CREATE TRIGGER update_treatment_plans_updated_at
  BEFORE UPDATE ON public.treatment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
