-- 抽奖开关 + 后台可编辑奖品

CREATE TABLE IF NOT EXISTS lottery_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO lottery_settings (id, enabled) VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE lottery_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_select_lottery_settings" ON lottery_settings;
CREATE POLICY "allow_anon_select_lottery_settings"
  ON lottery_settings FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "allow_anon_insert_lottery_settings" ON lottery_settings;
CREATE POLICY "allow_anon_insert_lottery_settings"
  ON lottery_settings FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_update_lottery_settings" ON lottery_settings;
CREATE POLICY "allow_anon_update_lottery_settings"
  ON lottery_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_insert_lottery_prizes" ON lottery_prizes;
CREATE POLICY "allow_anon_insert_lottery_prizes"
  ON lottery_prizes FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_update_lottery_prizes" ON lottery_prizes;
CREATE POLICY "allow_anon_update_lottery_prizes"
  ON lottery_prizes FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_anon_delete_lottery_prizes" ON lottery_prizes;
CREATE POLICY "allow_anon_delete_lottery_prizes"
  ON lottery_prizes FOR DELETE TO anon USING (true);

CREATE OR REPLACE FUNCTION perform_lottery_draw(
  p_visitor_ip TEXT,
  p_user_agent TEXT DEFAULT '',
  p_session_id TEXT DEFAULT ''
) RETURNS JSON AS $$
DECLARE
  v_settings RECORD;
  v_existing RECORD;
  v_total_remaining INT;
  v_roll DOUBLE PRECISION;
  v_pick INT;
  v_offset INT;
  v_tier RECORD;
  v_draw RECORD;
  v_consolation TEXT := '满5减0.5';
BEGIN
  SELECT * INTO v_settings FROM lottery_settings WHERE id = 1;
  IF NOT FOUND OR NOT v_settings.enabled THEN
    RAISE EXCEPTION 'lottery_closed';
  END IF;

  IF p_user_agent IS NULL OR p_user_agent !~* 'Windows' THEN
    RAISE EXCEPTION 'windows_only';
  END IF;

  IF p_session_id IS NULL OR trim(p_session_id) = '' THEN
    RAISE EXCEPTION 'session_required';
  END IF;

  SELECT * INTO v_existing FROM lottery_draws WHERE session_id = trim(p_session_id) LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'already_drawn';
  END IF;

  SELECT COALESCE(SUM(remaining_quota), 0) INTO v_total_remaining
  FROM lottery_prizes WHERE remaining_quota > 0;

  v_roll := random();

  IF v_total_remaining > 0 AND v_roll < 0.2 THEN
    v_pick := floor(random() * v_total_remaining)::INT;
    v_offset := 0;

    FOR v_tier IN
      SELECT * FROM lottery_prizes WHERE remaining_quota > 0 ORDER BY sort_order
    LOOP
      IF v_pick < v_offset + v_tier.remaining_quota THEN
        UPDATE lottery_prizes
        SET remaining_quota = remaining_quota - 1
        WHERE tier = v_tier.tier;

        INSERT INTO lottery_draws (
          visitor_ip, user_agent, session_id, won,
          prize_tier, prize_label, prize_description, consolation_coupon
        ) VALUES (
          trim(COALESCE(p_visitor_ip, '')), COALESCE(p_user_agent, ''), trim(p_session_id),
          true, v_tier.tier, v_tier.label, v_tier.description, ''
        ) RETURNING * INTO v_draw;

        RETURN row_to_json(v_draw);
      END IF;
      v_offset := v_offset + v_tier.remaining_quota;
    END LOOP;
  END IF;

  INSERT INTO lottery_draws (
    visitor_ip, user_agent, session_id, won, consolation_coupon
  )
  VALUES (
    trim(COALESCE(p_visitor_ip, '')), COALESCE(p_user_agent, ''), trim(p_session_id),
    false, v_consolation
  )
  RETURNING * INTO v_draw;

  RETURN row_to_json(v_draw);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
