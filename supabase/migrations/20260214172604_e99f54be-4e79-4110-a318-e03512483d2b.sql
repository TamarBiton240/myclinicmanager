
-- 1. Add staff access to treatment_areas
CREATE POLICY "Staff can view assigned treatment areas"
  ON public.treatment_areas FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointments.id = treatment_areas.appointment_id
    AND appointments.staff_member_id = auth.uid()
  ));

CREATE POLICY "Staff can update assigned treatment areas"
  ON public.treatment_areas FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointments.id = treatment_areas.appointment_id
    AND appointments.staff_member_id = auth.uid()
  ));

CREATE POLICY "Staff can insert assigned treatment areas"
  ON public.treatment_areas FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.appointments
    WHERE appointments.id = treatment_areas.appointment_id
    AND appointments.staff_member_id = auth.uid()
  ));

-- 2. Restrict clinic_settings to staff/admin only
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.clinic_settings;
CREATE POLICY "Staff and admins can view settings"
  ON public.clinic_settings FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'staff')
  );

-- 3. Restrict staff_working_hours to staff/admin only
DROP POLICY IF EXISTS "Authenticated can view working hours" ON public.staff_working_hours;
CREATE POLICY "Staff and admins can view working hours"
  ON public.staff_working_hours FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'staff')
  );
