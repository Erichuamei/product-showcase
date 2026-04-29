// 配置模块 — 集中管理所有配置项
const CONFIG = {
  // ★ 本地测试模式：设为 true 时使用 localStorage 模拟数据库，无需 Supabase
  // ★ 正式部署时改为 false，并填写下方 Supabase 配置
  DEMO_MODE: false,

  // Supabase 项目 URL
  SUPABASE_URL: 'https://qvaepodstqaakwtggylz.supabase.co',

  // Supabase 匿名公钥
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2YWVwb2RzdHFhYWt3dGdneWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5MzI3MjEsImV4cCI6MjA5MjUwODcyMX0.xr_HwrqbOKlBgA66mThLEcZvjKbXESxVLa4Fv6F0qg4',

  // Supabase Storage 存储桶名称
  STORAGE_BUCKET: 'product-images',

  // 管理后台登录密码（请替换为你自己的密码）
  ADMIN_PASSWORD: 'admin123',

  // 图片最大文件大小：5MB
  MAX_IMAGE_SIZE: 5 * 1024 * 1024
};
