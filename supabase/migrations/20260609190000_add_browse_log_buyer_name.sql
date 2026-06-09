-- 浏览记录附带本地已保存的预约/下单姓名

ALTER TABLE browse_logs
  ADD COLUMN IF NOT EXISTS buyer_name TEXT NOT NULL DEFAULT '';
