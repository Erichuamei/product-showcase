-- 前台浏览记录

CREATE TABLE IF NOT EXISTS browse_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'page_view',
  page TEXT NOT NULL DEFAULT 'index',
  product_id UUID,
  product_name TEXT NOT NULL DEFAULT '',
  product_sku TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  visitor_ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS browse_logs_created_at_idx ON browse_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS browse_logs_event_type_idx ON browse_logs (event_type);

ALTER TABLE browse_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_insert_browse_logs" ON browse_logs;
CREATE POLICY "allow_anon_insert_browse_logs"
  ON browse_logs FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_select_browse_logs" ON browse_logs;
CREATE POLICY "allow_anon_select_browse_logs"
  ON browse_logs FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "allow_anon_delete_browse_logs" ON browse_logs;
CREATE POLICY "allow_anon_delete_browse_logs"
  ON browse_logs FOR DELETE TO anon USING (true);
