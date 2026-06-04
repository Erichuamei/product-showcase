# 内购商品展示平台 — 项目记忆文件

> 本文档供 AI 与开发者快速了解工程全貌、协作约定与发布流程。  
> 最后更新：2026-06-04

---

## 一、项目概述

**名称**：内购商品展示平台（product-showcase）  
**类型**：纯静态前端 + Supabase 后端（BaaS）  
**用途**：公司内部内购场景——同事浏览在售商品、填写姓名购买；管理员维护商品与查看订单。

**技术栈**：
- 前端：HTML + CSS + 原生 JavaScript（无构建工具、无框架）
- 后端：Supabase（PostgreSQL + Storage + RPC）
- 代码托管：[GitHub Erichuamei/product-showcase](https://github.com/Erichuamei/product-showcase)
- 线上部署：Vercel（连接 GitHub，`git push` 后自动重新部署）

**本地工程路径**：`C:\Users\Administrator\Desktop\内购新`

---

## 二、目录与文件职责

```
内购新/
├── index.html              # 商品展示页（同事访问）
├── admin.html              # 管理后台（密码登录）
├── css/style.css           # 全站样式
├── js/
│   ├── config.js           # ★ 集中配置（DEMO_MODE、Supabase、管理密码）
│   ├── supabase.js         # Supabase 客户端；DEMO 时 mock localStorage
│   ├── app.js              # 展示页逻辑（列表、购买）
│   └── admin.js            # 后台逻辑（商品 CRUD、订单、导出）
├── sql/
│   └── setup-orders.sql    # 订单表 + purchase_product 函数（历史参考脚本）
├── supabase/
│   ├── config.toml         # Supabase CLI 配置（project_id = ewqbivlejsneqqcsugep）
│   └── migrations/         # 数据库迁移文件（db push 用）
├── deployment-guide.md     # 完整部署文档（Supabase + GitHub + Vercel）
├── 同事操作手册-从零开始配置.md  # 非技术人员操作手册（含 GitHub Pages 方案）
├── .gitignore              # 忽略 supabase/.temp、密钥文件等
└── PROJECT_MEMORY.md       # 本文件
```

**脚本加载顺序**（两页面相同）：
1. `config.js`
2. 若 `!CONFIG.DEMO_MODE` → 动态加载 Supabase CDN（`@supabase/supabase-js@2`）
3. `supabase.js` → `app.js` 或 `admin.js`

---

## 三、配置说明（js/config.js）

| 配置项 | 说明 |
|--------|------|
| `DEMO_MODE` | `true`：localStorage 模拟库，无需 Supabase；`false`：正式连云端 |
| `SUPABASE_URL` | 项目 API 地址 |
| `SUPABASE_ANON_KEY` | 匿名公钥（前端可见，依赖 RLS 保护） |
| `STORAGE_BUCKET` | 图片桶名，固定 `product-images`（须 Public） |
| `ADMIN_PASSWORD` | 管理后台明文密码（存于前端，仅简单门禁） |
| `MAX_IMAGE_SIZE` | 5MB；超出则用 Canvas 压缩为 JPEG |

**安全提醒**：`config.js` 含密钥，GitHub 仓库为 Public 时有泄露风险；勿将 Access Token 写入仓库。

---

## 四、数据库结构（Supabase）

**项目 ID**：`ewqbivlejsneqqcsugep`  
**区域**：Northeast Asia (Tokyo)  
**控制台**：https://supabase.com/dashboard/project/ewqbivlejsneqqcsugep

### 4.1 表 `products`（商品）

| 字段 | 类型/说明 |
|------|-----------|
| `id` | UUID 主键 |
| `name` | 商品名称（必填） |
| `price` | 价格 NUMERIC |
| `sku` | 货号 |
| `quantity` | 库存数量 |
| `product_sku` | SKU |
| `remark` | 备注 |
| `image_url` | Storage 中图片文件名（非完整 URL） |
| `status` | `active` 在售 / `inactive` 已下架 |
| `sort_order` | 排序序号，越小越靠前；默认 9999 |
| `created_at` / `updated_at` | 时间戳 |

展示页只查询 `status = 'active'`，按 `sort_order` 升序、`created_at` 降序。

### 4.2 表 `orders`（购买记录）

| 字段 | 说明 |
|------|------|
| `id` | UUID 主键 |
| `product_id` | 外键 → products |
| `product_name` | 冗余商品名 |
| `buyer_name` | 购买人姓名 |
| `buyer_ip` | 购买时 IP（防滥用） |
| `quantity` | 购买数量 |
| `created_at` | 购买时间 |

### 4.3 RPC `purchase_product`

原子操作：`FOR UPDATE` 锁行 → 校验库存 → 扣减 `products.quantity` → 插入 `orders` → 返回订单 JSON。  
库存不足时抛出 `insufficient_stock`。

### 4.4 Storage

- 桶名：`product-images`（必须 Public）
- 策略：anon 角色需 SELECT / INSERT / DELETE
- 前端图片 URL 规则：`{SUPABASE_URL}/storage/v1/object/public/product-images/{filename}`

### 4.5 RLS

products、orders 均启用 RLS，当前策略为 **anon 可读写删**（小型内购场景，非高安全模型）。

---

## 五、页面功能详解

### 5.1 展示页 `index.html` + `app.js`

| 功能 | 实现要点 |
|------|----------|
| 商品网格 | 仅 `active` 商品，卡片含图、名、价、SKU、库存、备注、「我要买」 |
| 售罄 | `quantity <= 0` 时按钮 disabled |
| 购买弹窗 | 数量（1~库存）、购买人姓名（必填） |
| 提交购买 | 调用 `rpc('purchase_product', {...})` |
| 获取 IP | 先 `myip.ipip.net`，失败则 `api.ipify.org` |
| 成功反馈 | 提示 2 秒后关弹窗并刷新列表 |
| 错误处理 | `insufficient_stock` →「库存不足」 |

### 5.2 管理后台 `admin.html` + `admin.js`

| 模块 | 功能 |
|------|------|
| 登录 | 密码对比 `CONFIG.ADMIN_PASSWORD`；状态存 `localStorage.admin_authenticated` |
| 添加商品 | 图片（JPG/PNG/WebP）、名称、价格、货号、数量、排序、SKU、备注；上传 Storage + insert |
| 编辑商品 | `startEdit` 填表 → `editProduct` 更新（可换图） |
| 商品列表 | 筛选：全部 / 在售 / 已下架 |
| 排序 | 表单填 `sort_order`；列表「上移/下移」与相邻商品交换序号 |
| 上下架 | `toggleProductStatus` |
| 删除商品 | 删 DB 记录 + Storage 图片 |
| 购买记录 | 分页（20 条/页）、删除单条 |
| 导出 | CSV（UTF-8 BOM），文件名 `购买记录_YYYY-MM-DD.csv` |
| 备注悬停 | `.cell-truncate` + tooltip bubble |

**图片处理**：`compressImage` 超 5MB 时 Canvas 迭代降 quality 至 JPEG。

### 5.3 DEMO 模式 `supabase.js`

`DEMO_MODE: true` 时：
- `demo_products`、`demo_images`（base64）、`demo_orders` 存 localStorage
- 模拟 `.from()` / `.storage` / `.rpc('purchase_product')`
- 控制台输出：`本地测试模式已启用`

---

## 六、基础设施与工具链（已配置）

| 项目 | 状态 |
|------|------|
| Git 远程 | `origin` → `https://github.com/Erichuamei/product-showcase.git`，分支 `main` |
| Git 推送 | 用户已登录 GitHub，可 `git push` |
| Supabase CLI | 通过 `npx supabase`；项目已 `link` |
| Access Token | 用户环境变量 `SUPABASE_ACCESS_TOKEN`（勿提交、勿写入聊天） |
| Docker Desktop | **公司禁止安装**；不影响远程 `db push` / `db query --linked` |
| 不可用 | `supabase start`、`db pull`（需 Docker） |

**常用 CLI 命令**：
```powershell
cd "C:\Users\Administrator\Desktop\内购新"
$env:SUPABASE_ACCESS_TOKEN = [System.Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN','User')

# 远程查库
npx supabase db query --linked "SELECT ..."

# 推送迁移（改表结构时）
npx supabase db push --yes
```

---

## 七、负责人（用户）的工作流期望 ★

> **所有功能调整必须遵循以下顺序，未经用户明确确认不得发布。**

```
① 先改本地文件
      ↓
② 本地测试通过
      ↓
③ 用户确认「可以上传」后，再 push 到 GitHub / Supabase
```

### 7.1 本地测试方式

**方式 A — 演示模式（只测 UI，不连库）**
```javascript
// js/config.js
DEMO_MODE: true,
```
浏览器直接打开 `index.html` / `admin.html`。

**方式 B — 连真实 Supabase（推荐，接近线上）**
```javascript
DEMO_MODE: false,
```
```powershell
cd "C:\Users\Administrator\Desktop\内购新"
npx --yes serve . -p 3000
```
- 展示页：http://localhost:3000/index.html  
- 管理后台：http://localhost:3000/admin.html  

### 7.2 发布规则

| 变更类型 | 发布动作 | 时机 |
|----------|----------|------|
| 前端（html/css/js） | `git add` → `commit` → `git push` | 用户确认后 |
| 数据库表/函数 | 写 `supabase/migrations/*.sql` → `npx supabase db push --yes` | 用户确认后；**先于**前端 push（若页面依赖新字段） |
| 仅改商品/订单数据 | 管理后台操作 | 无需 Git |

**禁止**：
- 未经确认自动 `git push` 或 `db push`
- 将 Token、数据库密码写入仓库
- 建议用户把密钥发到聊天

### 7.3 与用户沟通习惯

- 改完后说明：改了什么文件、如何本地测试、测试检查点
- 等用户说「可以上传 / 发布 / push」再执行发布命令
- 回复使用**简体中文**

---

## 八、代码风格与修改原则

- 保持现有模式：原生 JS、无构建、函数 + 全局事件
- 配置集中在 `config.js`，Supabase 初始化在 `supabase.js`
- 最小改动范围，不重构无关代码
- 新数据库变更用迁移文件，不直接改 `setup-orders.sql`（该文件为历史参考）
- 注释仅用于非显而易见业务逻辑

---

## 九、已知文档与部署差异

- `deployment-guide.md`：Vercel + GitHub 网页上传流程
- `同事操作手册-从零开始配置.md`：含 GitHub Pages 方案
- **当前实际**：Git 命令行 push + Vercel 自动部署 + Supabase CLI 管库

---

## 十、快速排错

| 现象 | 可能原因 |
|------|----------|
| 页面空白 / Failed to fetch | `SUPABASE_URL` 或 Key 错误 |
| 图片上传失败 | Storage 桶或 INSERT 策略未配 |
| 购买失败 insufficient_stock | 库存不足 |
| 购买失败找不到函数 | `purchase_product` 未创建 |
| 修改排序失败 | `products` 表缺 `sort_order` 列 |
| push 后网站未更新 | 未 push 或 Vercel 部署延迟 |
| Vercel 404 | `index.html` 不在仓库根目录 |

---

## 十一、待用户提需求时的检查清单

AI 收到需求后应自问：

1. 改的是前端、数据库结构，还是仅数据？
2. 是否需要新迁移 SQL？
3. 本地测试用 DEMO 还是 `serve` + 真实库？
4. 是否等用户确认后再 push？
5. 是否避免在回复中复述完整密钥？

---

*本文档随项目演进更新；重大架构变更时请同步修改 `.cursor/rules/project-memory.mdc`。*
