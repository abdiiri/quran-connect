ALTER TABLE public.app_users DROP CONSTRAINT app_users_role_check;
ALTER TABLE public.app_users ADD CONSTRAINT app_users_role_check CHECK (role IN ('learner', 'teacher', 'admin'));