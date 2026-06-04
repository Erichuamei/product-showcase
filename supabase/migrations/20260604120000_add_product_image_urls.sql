-- 商品多图：image_urls 数组，image_url 保留为封面（第一张）兼容旧逻辑

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 将已有单图迁移到 image_urls
UPDATE products
SET image_urls = jsonb_build_array(image_url)
WHERE image_url IS NOT NULL
  AND image_url <> ''
  AND (image_urls IS NULL OR image_urls = '[]'::jsonb);
