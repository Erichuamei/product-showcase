-- ============================================================
-- 购买订单数据库设置脚本
-- ============================================================
-- 使用说明：请在 Supabase SQL Editor 中执行此脚本
-- 此脚本将创建 orders 表、purchase_product RPC 函数和相关 RLS 策略
-- ============================================================

-- 1. 创建 orders 表（购买记录表）
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,          -- 订单主键，自动生成
  product_id UUID NOT NULL REFERENCES products(id),       -- 关联商品ID，外键指向 products 表
  product_name TEXT NOT NULL,                              -- 商品名称（冗余存储，避免 JOIN）
  buyer_name TEXT NOT NULL,                                -- 购买人姓名
  buyer_ip TEXT DEFAULT '',                                -- 购买人IP地址（防恶意点击）
  quantity INTEGER NOT NULL CHECK (quantity > 0),          -- 购买数量，必须大于 0
  created_at TIMESTAMPTZ DEFAULT NOW()                     -- 购买时间，默认当前时间
);

-- 2. 创建 purchase_product RPC 函数（原子操作：扣减库存 + 插入订单）
CREATE OR REPLACE FUNCTION purchase_product(
  p_product_id UUID,
  p_quantity INTEGER,
  p_buyer_name TEXT,
  p_buyer_ip TEXT DEFAULT ''
) RETURNS JSON AS $$
DECLARE
  v_product RECORD;
  v_order RECORD;
BEGIN
  -- 锁定商品行，防止并发超卖
  SELECT id, name, quantity INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  -- 检查库存是否充足
  IF v_product.quantity < p_quantity THEN
    RAISE EXCEPTION 'insufficient_stock';
  END IF;

  -- 扣减库存
  UPDATE products
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE id = p_product_id;

  -- 插入购买记录（含IP）
  INSERT INTO orders (product_id, product_name, buyer_name, buyer_ip, quantity)
  VALUES (p_product_id, v_product.name, p_buyer_name, p_buyer_ip, p_quantity)
  RETURNING * INTO v_order;

  -- 返回订单数据
  RETURN row_to_json(v_order);
END;
$$ LANGUAGE plpgsql;

-- 3. 启用 orders 表的行级安全策略（RLS）
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 允许匿名用户查询购买记录
CREATE POLICY "允许匿名用户查询购买记录"
  ON orders
  FOR SELECT
  TO anon
  USING (true);

-- 允许匿名用户插入购买记录
CREATE POLICY "允许匿名用户插入购买记录"
  ON orders
  FOR INSERT
  TO anon
  WITH CHECK (true);
