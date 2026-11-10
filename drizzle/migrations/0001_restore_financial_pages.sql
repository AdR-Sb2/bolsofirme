ALTER TABLE public.banks ADD COLUMN logo text NOT NULL DEFAULT '';
ALTER TABLE public.cards ADD COLUMN brand text NOT NULL DEFAULT '';
CREATE TABLE public.user_settings (user_id uuid PRIMARY KEY DEFAULT auth.uid(), onboarding_complete boolean NOT NULL DEFAULT false, selected_banks text[] NOT NULL DEFAULT '{}');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings" ON public.user_settings FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE TABLE public.investments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(), name text NOT NULL, ticker text NOT NULL DEFAULT '', asset_type text NOT NULL DEFAULT 'Outro', quantity numeric NOT NULL CHECK (quantity>0), average_price_cents bigint NOT NULL DEFAULT 0, current_price_cents bigint NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investments" ON public.investments FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE TABLE public.user_profiles (user_id uuid PRIMARY KEY DEFAULT auth.uid(), display_name text NOT NULL DEFAULT '', avatar_url text NOT NULL DEFAULT '');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in profile search" ON public.user_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile insert" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (user_id=auth.uid());
CREATE POLICY "own profile update" ON public.user_profiles FOR UPDATE TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
CREATE TABLE public.connection_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sender_id uuid NOT NULL, recipient_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(sender_id<>recipient_id));
CREATE UNIQUE INDEX connection_pair ON public.connection_requests (least(sender_id,recipient_id),greatest(sender_id,recipient_id));
GRANT SELECT, INSERT ON public.connection_requests TO authenticated;
GRANT UPDATE(status,updated_at) ON public.connection_requests TO authenticated;
GRANT ALL ON public.connection_requests TO service_role;
ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read requests" ON public.connection_requests FOR SELECT TO authenticated USING (auth.uid() IN (sender_id,recipient_id));
CREATE POLICY "sender creates pending request" ON public.connection_requests FOR INSERT TO authenticated WITH CHECK (sender_id=auth.uid() AND status='pending');
CREATE POLICY "recipient responds" ON public.connection_requests FOR UPDATE TO authenticated USING (recipient_id=auth.uid() AND status='pending') WITH CHECK (recipient_id=auth.uid() AND status IN ('accepted','rejected'));
CREATE TABLE public.connection_permissions (owner_id uuid NOT NULL, viewer_id uuid NOT NULL, share_balances boolean NOT NULL DEFAULT false, share_transactions boolean NOT NULL DEFAULT false, share_investments boolean NOT NULL DEFAULT false, PRIMARY KEY(owner_id,viewer_id), CHECK(owner_id<>viewer_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connection_permissions TO authenticated;
GRANT ALL ON public.connection_permissions TO service_role;
ALTER TABLE public.connection_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads permissions" ON public.connection_permissions FOR SELECT TO authenticated USING (owner_id=auth.uid());
CREATE POLICY "owner grants accepted connection" ON public.connection_permissions FOR INSERT TO authenticated WITH CHECK (owner_id=auth.uid() AND EXISTS(SELECT 1 FROM public.connection_requests r WHERE r.status='accepted' AND ((r.sender_id=owner_id AND r.recipient_id=viewer_id) OR (r.recipient_id=owner_id AND r.sender_id=viewer_id))));
CREATE POLICY "owner edits accepted permission" ON public.connection_permissions FOR UPDATE TO authenticated USING(owner_id=auth.uid()) WITH CHECK (owner_id=auth.uid() AND EXISTS(SELECT 1 FROM public.connection_requests r WHERE r.status='accepted' AND ((r.sender_id=owner_id AND r.recipient_id=viewer_id) OR (r.recipient_id=owner_id AND r.sender_id=viewer_id))));
CREATE POLICY "owner revokes permission" ON public.connection_permissions FOR DELETE TO authenticated USING(owner_id=auth.uid());
CREATE FUNCTION public.shared_finance_summary() RETURNS TABLE(user_id uuid,banks bigint,transactions bigint,investments bigint,income bigint,expense bigint,assets numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT p.owner_id,
CASE WHEN p.share_balances THEN (SELECT count(*) FROM public.banks b WHERE b.user_id=p.owner_id) ELSE 0 END,
CASE WHEN p.share_transactions THEN (SELECT count(*) FROM public.transactions t WHERE t.user_id=p.owner_id) ELSE 0 END,
CASE WHEN p.share_investments THEN (SELECT count(*) FROM public.investments i WHERE i.user_id=p.owner_id) ELSE 0 END,
CASE WHEN p.share_transactions THEN coalesce((SELECT sum(amount_cents) FROM public.transactions t WHERE t.user_id=p.owner_id AND type='receita'),0)::bigint ELSE 0 END,
CASE WHEN p.share_transactions THEN coalesce((SELECT sum(amount_cents) FROM public.transactions t WHERE t.user_id=p.owner_id AND type='despesa'),0)::bigint ELSE 0 END,
CASE WHEN p.share_investments THEN coalesce((SELECT sum(quantity*current_price_cents) FROM public.investments i WHERE i.user_id=p.owner_id),0) ELSE 0 END
FROM public.connection_permissions p WHERE p.viewer_id=auth.uid() AND EXISTS(SELECT 1 FROM public.connection_requests r WHERE r.status='accepted' AND ((r.sender_id=p.owner_id AND r.recipient_id=p.viewer_id) OR (r.recipient_id=p.owner_id AND r.sender_id=p.viewer_id))) $$;
REVOKE ALL ON FUNCTION public.shared_finance_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shared_finance_summary() TO authenticated;
CREATE INDEX ON public.investments(user_id);
INSERT INTO public.user_settings(user_id,onboarding_complete,selected_banks) SELECT user_id,true,array_agg(name) FROM public.banks GROUP BY user_id ON CONFLICT(user_id) DO NOTHING;