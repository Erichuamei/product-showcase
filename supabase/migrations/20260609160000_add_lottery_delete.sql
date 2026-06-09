-- 后台删除抽奖记录：删除后该 IP 可重新抽奖；若曾中奖则恢复奖品库存

CREATE OR REPLACE FUNCTION delete_lottery_draw(p_draw_id UUID)
RETURNS JSON AS $$
DECLARE
  v_draw RECORD;
BEGIN
  SELECT * INTO v_draw FROM lottery_draws WHERE id = p_draw_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'draw_not_found';
  END IF;

  IF v_draw.won AND v_draw.prize_tier IS NOT NULL THEN
    UPDATE lottery_prizes
    SET remaining_quota = LEAST(total_quota, remaining_quota + 1)
    WHERE tier = v_draw.prize_tier;
  END IF;

  DELETE FROM lottery_draws WHERE id = p_draw_id;

  RETURN row_to_json(v_draw);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_lottery_draw(UUID) TO anon;
