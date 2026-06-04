-- 预约记录增加用户备注（如规格说明）

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS buyer_remark TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION purchase_product(
  p_product_id UUID,
  p_quantity INTEGER,
  p_buyer_name TEXT,
  p_buyer_ip TEXT DEFAULT '',
  p_buyer_remark TEXT DEFAULT ''
) RETURNS JSON AS $$
DECLARE
  v_product RECORD;
  v_order RECORD;
BEGIN
  SELECT id, name, quantity INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF v_product.quantity < p_quantity THEN
    RAISE EXCEPTION 'insufficient_stock';
  END IF;

  UPDATE products
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;

  INSERT INTO orders (product_id, product_name, buyer_name, buyer_ip, quantity, buyer_remark)
  VALUES (p_product_id, v_product.name, p_buyer_name, p_buyer_ip, p_quantity, COALESCE(p_buyer_remark, ''))
  RETURNING * INTO v_order;

  RETURN row_to_json(v_order);
END;
$$ LANGUAGE plpgsql;
