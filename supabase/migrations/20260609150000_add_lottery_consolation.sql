-- 未中奖安慰券：满5减0.5

ALTER TABLE lottery_draws
  ADD COLUMN IF NOT EXISTS consolation_coupon TEXT NOT NULL DEFAULT '';

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
  v_consolation TEXT := '满5减0.5';
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
          trim(p_visitor_ip), COALESCE(p_user_agent, ''), COALESCE(p_session_id, ''),
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
    trim(p_visitor_ip), COALESCE(p_user_agent, ''), COALESCE(p_session_id, ''),
    false, v_consolation
  )
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

  IF NOT v_draw.won AND trim(COALESCE(v_draw.consolation_coupon, '')) = '' THEN
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
