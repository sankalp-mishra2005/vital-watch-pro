
ALTER TABLE public.alerts
  ADD COLUMN notified_email boolean NOT NULL DEFAULT false,
  ADD COLUMN notified_sms boolean NOT NULL DEFAULT false;
