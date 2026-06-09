-- 商品参考原价（展示页划线价，选填）

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS original_price NUMERIC;
