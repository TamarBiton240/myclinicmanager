
-- Clients table
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  date_of_birth DATE,
  medical_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clients" ON public.clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clients" ON public.clients FOR DELETE USING (auth.uid() = user_id);

-- Appointments table
CREATE TYPE public.treatment_type AS ENUM ('laser', 'electrolysis');
CREATE TYPE public.payment_status AS ENUM ('paid', 'debt', 'package');

CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  treatment_type treatment_type NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60,
  notes TEXT,
  is_completed BOOLEAN DEFAULT false,
  is_summary_signed_off BOOLEAN DEFAULT false,
  payment_status payment_status,
  next_reminder_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own appointments" ON public.appointments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own appointments" ON public.appointments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own appointments" ON public.appointments FOR DELETE USING (auth.uid() = user_id);

-- Treatment areas (details per body area per appointment)
CREATE TABLE public.treatment_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE NOT NULL,
  area_name TEXT NOT NULL,
  heat_level NUMERIC,
  pain_level INT CHECK (pain_level >= 1 AND pain_level <= 10),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.treatment_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own treatment areas" ON public.treatment_areas FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.appointments WHERE appointments.id = treatment_areas.appointment_id AND appointments.user_id = auth.uid()));
CREATE POLICY "Users can insert own treatment areas" ON public.treatment_areas FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.appointments WHERE appointments.id = treatment_areas.appointment_id AND appointments.user_id = auth.uid()));
CREATE POLICY "Users can update own treatment areas" ON public.treatment_areas FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.appointments WHERE appointments.id = treatment_areas.appointment_id AND appointments.user_id = auth.uid()));
CREATE POLICY "Users can delete own treatment areas" ON public.treatment_areas FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.appointments WHERE appointments.id = treatment_areas.appointment_id AND appointments.user_id = auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
