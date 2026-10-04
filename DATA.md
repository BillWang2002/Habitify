# 习惯与金币数据接入

更新日期：2026-10-04。
状态：代码和迁移已实施，本地 PostgreSQL 测试通过；线上迁移和 habits Edge Function 已部署，匿名/无效 token 均返回 401、CORS 预检 200；Pages 已发布，真实测试账户的新增、部分进度、达标、刷新保留、撤回/恢复金币、规则页已通过；双账户线上业务隔离和本轮 iPhone 真机待复测。

## 已确认架构

用户选择统一 Edge Functions API + 数据库 RPC/事务。当前普通业务入口为 `/functions/v1/habits`：验证用户身份后，携带该用户 token 调用受限 `habitify_request`，不使用管理密钥。后续后台管理另设专用接口，范围见 ADMIN.md。

数据库函数承担身份、所有权、输入范围、归属日、幂等、版本冲突和奖励事务。表启用 RLS，匿名和普通用户无直接表读写权限；私有辅助函数禁止客户端执行。公开业务 RPC 允许 authenticated 调用，仍执行完整校验，因此绕过 Edge API 调用它也不能绕过金币规则。本轮未承诺所有流量只能来自 Edge；未来需要独占入口或统一限流时单独设计受限服务角色，不能只隐藏 RPC 名称。

## 本轮范围

- 每天计划的完成型/数量型习惯：新增、读取、当天进度、撤销、排序、归档/恢复、删除/短时撤回。
- 真实历史日历、累计完成天数、最近 200 条操作日志；每条记录保存当日目标。目标编辑和星期计划尚未开放，不改写历史。
- 金币流水、每日普通奖励、连续奖励、失效撤回、余额及“我的 → 金币规则”。数值见 COINS.md。
- 新账户为空；原内存演示不自动导入。正式界面删除演示/重置文案，公开 preview.html 仅保留明确标识的独立视觉预览，不读写用户数据。
- 仅在线操作；没有业务离线队列。网络失败不能提示保存成功，也不把私有记录写入公共 PWA 缓存。

## 数据和一致性

`habit_profiles` 保存账户时区与数据 revision；`habits` 保存固定每日计划及图标资产 ID；`habit_records` 保存归属日、目标快照与进度；`habit_logs` 保存进度修改；`coin_rules` 是不可由客户端编辑的规则版本；`coin_entitlements` 保存节点当前应得金额；`coin_ledger` 追加正负金额；`habit_requests` 保存写请求 UUID 和完整请求内容。

首次读取采用浏览器的 IANA 时区，并经数据库合法性校验后固定为账户时区。后续设备不能随请求修改它；时区设置入口和变更政策留待确认。日期由数据库时间换算，客户端所选日期不能决定发币日期。所有写请求必须匹配当前服务器日期和 revision；跨日/其他设备修改返回冲突，刷新后重新操作。

同一账户事务串行化。每次写携带 UUID，网络重试复用原内容；相同 UUID 不重复操作，内容不同拒绝。重放返回当前快照，避免旧成功响应覆盖新数据。前端不先行增加金币；退出/身份复核清理个人视图，通过会话代次屏蔽迟到响应。未确认的网络请求阻止下一次写，提供重试。

删除习惯为软删除，保留过去记录，清除当天进度并重算当天奖励。8 秒内可恢复习惯及当天进度；服务端校验期限和日期，不以本地计时授予恢复。归档保留已完成记录及行动日，停止当前列表中的打卡，恢复后重新加入。

普通奖励按完成时间与习惯 ID 分配，首达奖励先预留 5，再分配完成奖励：5 个习惯达标时总额为 50，第五个最多获得 5。撤销后可将释放的额度分配给仍达标的习惯，始终不超过上限。连续奖励按当日结算节点记账；本轮不开放历史修改/补签，过去已经成立的奖励不随未来中断撤回。

当前限定最多 100 个未删除习惯；完整历史记录随快照读取，适合小范围起步。历史规模增长时改为分页月份查询与服务端聚合；不能截断历史后仍声称累计统计完整。日志和金币明细分别只展示最近 200/100 条。专门的限流、导出、备份和完整管理权限验收仍待后续阶段。

## 发布步骤

1. 在 Supabase SQL Editor 执行 `supabase/migrations/202610040002_habits.sql` 一次。已有基础迁移无需重跑。它是单个事务；失败会整体回滚，重复执行会报已存在，不要反复运行。
2. Edge Functions 创建 `habits`，发布 `supabase/functions/habits/index.ts`。使用 Supabase 自动提供的服务端 `SUPABASE_URL` 与 `SUPABASE_ANON_KEY`，不填写管理 key。
3. 函数采用手动 `getUser` 校验真实用户 token；关闭该函数的 legacy JWT gateway 校验，对应 `supabase/config.toml` 的 `verify_jwt=false`。这不会让匿名业务请求通过，缺少/无效用户 token 仍返回 401。
4. 后端部署与拒绝路径检查通过后再同步 main，触发 Pages 发布。发布前保留旧前端可回退；新表不修改基础探针与认证配置。
5. 两个测试账户依次验收：新建 → 部分进度 → 达标 → 金币 → 刷新/重开持久化 → 撤销 → 恢复 → 归档/排序/删除；B 看不到 A，也不能提交 A 的 habitId。换设备同时修改，确认冲突提示和刷新。

若使用已登录的 CLI：`supabase functions deploy habits --project-ref crtzbheoogvcansekmmw --no-verify-jwt`。CLI 登录或个人访问凭据由用户在本机完成，不通过聊天发送。

## 验证记录

本地测试直接执行迁移到 PGlite PostgreSQL，模拟 Supabase 的 auth schema 与真实数据库角色。覆盖表/辅助函数拒绝、他人 habitId 拒绝、部分进度、奖励上限、重试、冲突、撤回恢复、删除恢复期限和 210 日叠加奖励。HTTP 客户端测试覆盖用户 token、相同请求重试、权限失败不重试及错误脱敏。

本地嵌入式数据库不等于 Supabase 集成；独立连接的真实并发、线上 JWT/CORS、PWA 跨设备和 iPhone 验收需另记，未通过之前不标记 P2/P3 完成。

官方依据：[Edge Functions 身份校验](https://supabase.com/docs/guides/functions/auth)、[新 API key 迁移](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)、[数据库安全](https://supabase.com/docs/guides/database/secure-data)。

2026-10-04：用户授权后在 Habitify-dev 执行迁移，SQL Editor 返回 Success. No rows returned；habits 函数发布成功，legacy gateway 校验关闭，函数内 getUser 身份校验保留。线上匿名/伪造 token 实测均 401 LOGIN_REQUIRED，OPTIONS 返回 200 与允许跨域响应头。38 项本地测试与构建通过；不代表线上双账户完整业务验收。

线上界面验收：使用原有测试账户会话，无读取/记录密码或令牌。新建“通信验收（可删除）”数量习惯，1/8 时行动日不成立且余额 0；8/8 时行动日成立、月历完成 1 天、余额 15；刷新后保留 15 与记录；撤销到 0 后余额 0；重新达标仍为 15。金币规则页实际返回规则版本 1。本轮测试习惯最终清零并归档，余额 0，保留操作与金币撤回流水供核对。线上双账号越权写入、真正跨设备并发、iPhone 新业务尚未验收。

补充线上数据库权限验证：在 SQL Editor 的可回滚事务内设定 authenticated 角色与第二个测试账户的 claims，断言其快照为空/金币为 0、对第一个账户 habitId 的 progress 请求返回 HABIT_NOT_FOUND、直接业务表 SELECT 和私有 snapshot helper 均 permission denied。断言全部通过，SQL 返回 Success. No rows returned，随后事务回滚；未保留第二账户初始化或写入。这是线上数据库权限测试，不等于第二账户经 Auth 登录后的 HTTP 集成验收。

最终前端补充：金币规则页选中“我的”导航并正确返回；个人数据按钮刷新真实习惯快照，不再读取测试探针。客户端丢弃迟到的较旧 revision/归属日快照，防止读取/保存响应顺序导致回退。38 项测试与 Pages 自动发布通过。
