-- 批量删除抽奖记录（一次请求，减少卡顿）

CREATE OR REPLACE FUNCTION delete_lottery_draws_batch(p_draw_ids UUID[])
RETURNS INT AS $$
DECLARE
  v_id UUID;
  v_draw RECORD;
  v_count INT := 0;
BEGIN
  IF p_draw_ids IS NULL OR array_length(p_draw_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOREACH v_id IN ARRAY p_draw_ids
  LOOP
    SELECT * INTO v_draw FROM lottery_draws WHERE id = v_id FOR UPDATE;
    IF FOUND THEN
      IF v_draw.won AND v_draw.prize_tier IS NOT NULL THEN
        UPDATE lottery_prizes
        SET remaining_quota = LEAST(total_quota, remaining_quota + 1)
        WHERE tier = v_draw.prize_tier;
      END IF;
      DELETE FROM lottery_draws WHERE id = v_id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_lottery_draws_batch(UUID[]) TO anon;
