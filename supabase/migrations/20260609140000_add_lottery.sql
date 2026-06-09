-- 内购抽奖：分级奖品、每 IP 限抽一次、约 20% 中奖率（5 次中 1 次）

CREATE TABLE IF NOT EXISTS lottery_prizes (
  tier TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  total_quota INT NOT NULL CHECK (total_quota >= 0),
  remaining_quota INT NOT NULL CHECK (remaining_quota >= 0),
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO lottery_prizes (tier, label, description, total_quota, remaining_quota, sort_order) VALUES
  ('special', '特等奖', '猫咪置物架', 1, 1, 1),
  ('first', '一等奖', '满20减5', 3, 3, 2),
  ('second', '二等奖', '满15减2', 6, 6, 3),
  ('third', '三等奖', '满10减1', 10, 10, 4)
ON CONFLICT (tier) DO NOTHING;

CREATE TABLE IF NOT EXISTS lottery_draws (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_ip TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  session_id TEXT NOT NULL DEFAULT '',
  won BOOLEAN NOT NULL DEFAULT false,
  prize_tier TEXT REFERENCES lottery_prizes(tier),
  prize_label TEXT,
  prize_description TEXT,
  winner_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS lottery_draws_visitor_ip_idx ON lottery_draws(visitor_ip);

ALTER TABLE lottery_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_draws ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_select_lottery_prizes" ON lottery_prizes;
CREATE POLICY "allow_anon_select_lottery_prizes"
  ON lottery_prizes FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "allow_anon_select_lottery_draws" ON lottery_draws;
CREATE POLICY "allow_anon_select_lottery_draws"
  ON lottery_draws FOR SELECT TO anon USING (true);

CREATE OR REPLACE FUNCTION perform_lottery_draw(
  p_visitor_ip TEXT,
  p_user_agent TEXT DEFAULT '',
  p_session_id TEXT DEFAULT ''
) RETURNS JSON AS $$
DECLARE
  v_existing RECORD;
  v_total_remaining INT;
  v_roll DOUBLE PRECISION;
  v_pick INT;
  v_offset INT;
  v_tier RECORD;
  v_draw RECORD;
BEGIN
  IF p_user_agent IS NULL OR p_user_agent !~* 'Windows' THEN
    RAISE EXCEPTION 'windows_only';
  END IF;

  IF p_visitor_ip IS NULL OR trim(p_visitor_ip) = '' THEN
    RAISE EXCEPTION 'ip_required';
  END IF;

  SELECT * INTO v_existing FROM lottery_draws WHERE visitor_ip = trim(p_visitor_ip) LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'already_drawn';
  END IF;

  SELECT COALESCE(SUM(remaining_quota), 0) INTO v_total_remaining
  FROM lottery_prizes WHERE remaining_quota > 0;

  v_roll := random();

  -- 约 20% 中奖（5 次中 1 次），且仍有奖品
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
          prize_tier, prize_label, prize_description
        ) VALUES (
          trim(p_visitor_ip), COALESCE(p_user_agent, ''), COALESCE(p_session_id, ''),
          true, v_tier.tier, v_tier.label, v_tier.description
        ) RETURNING * INTO v_draw;

        RETURN row_to_json(v_draw);
      END IF;
      v_offset := v_offset + v_tier.remaining_quota;
    END LOOP;
  END IF;

  INSERT INTO lottery_draws (visitor_ip, user_agent, session_id, won)
  VALUES (trim(p_visitor_ip), COALESCE(p_user_agent, ''), COALESCE(p_session_id, ''), false)
  RETURNING * INTO v_draw;

  RETURN row_to_json(v_draw);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION submit_lottery_winner_name(
  p_draw_id UUID,
  p_visitor_ip TEXT,
  p_winner_name TEXT
) RETURNS JSON AS $$
DECLARE
  v_draw RECORD;
BEGIN
  IF trim(COALESCE(p_winner_name, '')) = '' THEN
    RAISE EXCEPTION 'name_required';
  END IF;

  SELECT * INTO v_draw
  FROM lottery_draws
  WHERE id = p_draw_id AND visitor_ip = trim(p_visitor_ip)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'draw_not_found';
  END IF;

  IF NOT v_draw.won THEN
    RAISE EXCEPTION 'not_winner';
  END IF;

  IF trim(v_draw.winner_name) <> '' THEN
    RAISE EXCEPTION 'name_already_set';
  END IF;

  UPDATE lottery_draws
  SET winner_name = trim(p_winner_name)
  WHERE id = p_draw_id
  RETURNING * INTO v_draw;

  RETURN row_to_json(v_draw);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION perform_lottery_draw(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION submit_lottery_winner_name(UUID, TEXT, TEXT) TO anon;
