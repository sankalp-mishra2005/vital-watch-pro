
-- Add phone_number to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;

-- Create alerts table
CREATE TABLE public.alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  level text NOT NULL DEFAULT 'warning' CHECK (level IN ('warning', 'critical')),
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Admin can read all alerts
CREATE POLICY "Admin can read alerts"
  ON public.alerts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Patient can read own alerts
CREATE POLICY "Patient can read own alerts"
  ON public.alerts FOR SELECT
  USING (patient_id = auth.uid());

-- Service role inserts alerts (edge functions use service role)
-- No INSERT policy for anon/authenticated - only service role can insert

-- Admin can update alerts (resolve them)
CREATE POLICY "Admin can resolve alerts"
  ON public.alerts FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Drop old admin update policy and recreate with patient-only guard
DROP POLICY IF EXISTS "Admin can update any profile" ON public.profiles;

CREATE POLICY "Admin can update patient profiles only"
  ON public.profiles FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = profiles.id
      AND ur.role = 'patient'
    )
  );

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
