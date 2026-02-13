
-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'staff');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for profiles: users see own, admins see all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS for user_roles: admins can manage, users can read own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Staff working hours table
CREATE TABLE public.staff_working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  is_working boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_user_id, day_of_week)
);
ALTER TABLE public.staff_working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view working hours" ON public.staff_working_hours FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage working hours" ON public.staff_working_hours FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can update own hours" ON public.staff_working_hours FOR UPDATE TO authenticated USING (auth.uid() = staff_user_id);

-- Clinic settings table (key-value)
CREATE TABLE public.clinic_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view settings" ON public.clinic_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage settings" ON public.clinic_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Body areas config table
CREATE TABLE public.body_areas_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.body_areas_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view body areas" ON public.body_areas_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage body areas" ON public.body_areas_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Add staff_member_id to appointments
ALTER TABLE public.appointments ADD COLUMN staff_member_id uuid REFERENCES auth.users(id);

-- Update appointments RLS to allow staff to see assigned appointments
CREATE POLICY "Staff can view assigned appointments" ON public.appointments FOR SELECT USING (auth.uid() = staff_member_id);
CREATE POLICY "Staff can update assigned appointments" ON public.appointments FOR UPDATE USING (auth.uid() = staff_member_id);

-- Seed default body areas
INSERT INTO public.body_areas_config (area_name, sort_order) VALUES
  ('רגליים', 1), ('ידיים', 2), ('גב', 3), ('פנים', 4), ('ביקיני', 5);

-- Seed default clinic settings
INSERT INTO public.clinic_settings (setting_key, setting_value) VALUES
  ('working_hours', '{"start": "09:00", "end": "18:00"}'::jsonb),
  ('theme', '{"primary": "100 24% 54%", "secondary": "43 29% 90%"}'::jsonb);

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  -- First user becomes admin
  IF (SELECT count(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'staff');
  END IF;
  -- Create default working hours for new user
  INSERT INTO public.staff_working_hours (staff_user_id, day_of_week, start_time, end_time, is_working)
  SELECT NEW.id, d, '09:00', '17:00', d NOT IN (5, 6)
  FROM generate_series(0, 6) AS d;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
