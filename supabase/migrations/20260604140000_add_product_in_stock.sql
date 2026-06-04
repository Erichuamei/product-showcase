-- 商品是否现货（默认无现货）

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS in_stock BOOLEAN NOT NULL DEFAULT false;
