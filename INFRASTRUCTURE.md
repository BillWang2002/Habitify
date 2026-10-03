# 底层架构配置与通信验收

更新日期：2026-10-03。

## 当前架构

手机/电脑浏览器 → GitHub Pages 静态通信页 → Supabase Auth / Data API → Postgres RPC 与 RLS。
GitHub 仓库负责同步源码，GitHub Actions 负责生成和发布静态产物。
不需要额外租用服务器；敏感操作后续放到可信数据库函数或 Edge Functions。
当前通信页是工程验证工具，不是正式产品界面，也没有习惯或金币业务。

## 操作顺序与状态

| 层 | 配置 | 基础判断 | 当前结果 |
| --- | --- | --- | --- |
| L0 本地 | 本地静态服务、打包、诊断页 | 页面和相对路径资源返回 200；探针配置可加载 | 已通过；后端未配置时明确显示未连接 |
| L1 GitHub 同步 | 建仓库、远端、首次提交与推送 | 远端提交 SHA 与本地一致，内容完整 | 已通过：首次提交同步，Actions 基础检查通过 |
| L2 Pages | Actions 部署、公开网页地址 | 从正式网页打开诊断页及资源，版本与提交一致 | 已通过：正式网页加载、版本匹配、浏览器跨域健康检查成功 |
| L3 后端公共 API | 创建 Supabase 项目、运行迁移、设置公开连接参数 | health RPC 返回成功及服务端时间 | 已通过：用户执行迁移，health RPC HTTP 200 |
| L4 登录与私有 API | 关闭公开注册、管理员创建两个测试账户 | 登录后返回本人身份，探针可写入读取；退出后私有访问被拒绝 | 基础流程通过：正式页两账户身份校验、本人写入读取与退出切换日志符合预期 |
| L5 权限与完整链路 | 两账户验证、注册关闭设置检查 | B 查不到 A 的探针；匿名不能操作；Pages 上完成登录读写 | 基础通信通过；实际 signup 拒绝与伪造他人写入未覆盖，另列 P2 负向验收 |

### 2026-10-03 本地验证记录

- Git、Node、npm 可用；已初始化 main 分支，尚未提交或连接 GitHub。
- 3 项配置保护检查通过，静态打包通过，通信页脚本语法检查通过。
- http://127.0.0.1:5173 上页面、脚本、样式、配置与版本文件均返回 200。
- 浏览器实测显示版本 local、后端尚未配置，后端按钮禁用；未宣称云端通信成功。
- config.local.json、dist、.env 已排除在 Git 跟踪之外。
- 后端 SQL 迁移与 Pages workflow 已准备，但未在云端执行或验证。
- 下一步：用户创建空 GitHub 仓库，提供仓库网址；创建 Supabase 开发项目。

### 2026-10-03 GitHub 同步验证记录

- 远端：https://github.com/BillWang2002/Habitify.git ，本地 main 跟踪 origin/main。
- 首次提交 85acd5dfca954a90a14814e857c47197a721eba1 已推送；读取远端 main 核对与本地一致。
- 首次同步包含 19 个文件，未跟踪 dist、本地配置或管理凭据。
- 首次 Actions 检查成功，配置保护测试与脚本语法检查通过。
- [检查记录](https://github.com/BillWang2002/Habitify/actions/runs/37104599829)：后端变量未配置，构建、上传和部署均跳过。此结果不表示 Pages 已发布。
- 下一步：用户创建 Supabase 开发项目，提供公开连接参数；Pages 设置与后端验证仍待完成。

每层记录真实结果；不得用本地通过代替正式 Pages 通过，也不得用模拟响应代替真实 API。

### 2026-10-03 Supabase 初步连接验证

- 项目 URL：https://crtzbheoogvcansekmmw.supabase.co 。
- 仅把 Project URL 与 publishable key 写入被 Git 忽略的 config.local.json，静态打包与配置保护测试通过。
- npm run check:backend 实测：Auth health HTTP 200，JWKS HTTP 200；JWKS 无需在前端单独配置。
- infra_health 返回 HTTP 404 / PGRST202，测试 RPC 尚不存在或未进入 schema cache，迁移尚待用户执行。
- infra_identity 匿名请求返回 HTTP 404，不能当作权限拒绝验收通过。
- 尚未验证登录、数据库读写、两账户隔离或关闭注册。
- 用户误贴了一把后台 secret key，已提醒撤销并重新生成；未使用、未保存其值，撤销情况待用户确认。
- 后续：用户在 SQL Editor 执行迁移一次，再运行同一通信检查；随后配置管理员测试账户与 Pages。

L1 与 L3 可准备，但前置结果未通过的完整链路不能声明完成。

### 2026-10-03 初始化后验证

- 用户报告 SQL 执行结果为 Success. No rows returned，并报告已重新设置 secret key；新 key 不需要提供给项目。
- 实测 Auth health、JWKS、infra_health 均 HTTP 200，health 响应符合约定，L3 通过。
- 匿名调用 infra_identity 与读取 infra_probes 均 HTTP 401，匿名拒绝检查通过。
- auth settings 请求 HTTP 200，但 disable_signup 未确认是 true；关闭公开注册检查未通过，整个扩展检查命令以失败状态结束。
- 未发送 signup 请求，没有创建测试账户；登录、两账户 RLS 隔离、浏览器跨域与正式 Pages 链路仍未验证。
- 下一步：用户关闭 Allow new users to sign up、管理员创建两个测试账户；密码仅在通信页输入。
- 另需设置 GitHub Pages 为 GitHub Actions，并添加两个公开仓库变量。

### 2026-10-03 账户准备后的复检

- 用户报告两个测试账户已创建，不在公开文档保存其邮箱或密码。
- 六项后端检查全部通过：Auth、JWKS、公开注册关闭、health RPC、匿名私有 RPC 拒绝、匿名表读取拒绝。
- 注册关闭检查来自公开 auth settings 的 disable_signup=true；尚未发送实际注册请求，不能据此声称注册请求拒绝测试已完成。
- 本地通信页已打开，观察到浏览器显示公共 API 成功结果；本地浏览器到后端的公共通信已通过。
- 下一步人工登录验证：A 写入 1 条并读取，退出后 B 未写入前应读到 0 条；B 写入 1 条后仅见自己的 1 条，再返回 A 应仍仅见 A 自己的 1 条。
- 预期条数只适用于全新账户首次操作；如已多次写入则逐条归属验证，不能因为不等于 1 直接判隔离失败。
- 输入密码由用户在页面完成；不读取、收集或同步密码和令牌。
- Pages 仍未发布，L4/L5 不因账户创建报告而直接标记通过。

### 2026-10-03 用户提供的账户测试结果

- 测试账户 A：17:12:56 登录身份校验通过，17:13:03 可见 1 条，均属于当前账户。
- 测试账户 B：17:13:44 登录身份校验通过，17:13:46 可见 1 条，均属于当前账户。
- 证据来源为用户提供的本地页面输出；两账户登录与读取检查通过，日志中的归属断言未发现其他账户记录。
- 未包含 B 首次写入前 0 条结果或写入成功输出，不能声称六步流程全部已观察到；正式 Pages 上补齐写入与隔离复测。
- 下一步：按下方 Pages 配置指南完成发布，验证部署提交、资源和公开 API，再复测账户流程。

### 2026-10-03 正式 Pages 验证

- 正式地址：https://billwang2002.github.io/Habitify/ 。
- 首轮部署版本 af5175211d2e72daa885e05df21e040854c8b77d 与验证时本地提交一致。
- 页面、app.js、styles.css 和 config.json 实测均返回 HTTP 200；浏览器成功加载公开连接参数与版本。
- 正式页点击健康检查，17:24:37 显示公共 API 已通过，服务端返回有效时间。
- 正式页点击匿名拒绝检查，17:24:41 显示匿名调用私有 API 已被拒绝。
- L2 通过，Pages → Supabase 的公共跨域通信及匿名拒绝路径已实测。
- 正式页账户登录、探针写入与两账户隔离仍待用户复测，L4/L5 不标记完成。
- 两账户本地测试各已有 1 条记录，正式复测先读取，再各写入一次；应各自从 1 条增加到 2 条，不应要求再次为 0 条。
- 如果现有条数不同，按实际初始值加 1 并检查归属，避免把额外测试记录误判为隔离失败。

## 基础通信最终验收

上述记录按时间保留。以下为当前最终基础验收结果，以此段与状态表为准。

### 2026-10-03 正式网页账户闭环验收

证据来源：用户提供的正式网页操作输出，不宣称 Codex 持有密码或独立代登录。

| 测试 | 时间 | 实际结果 |
| --- | --- | --- |
| A 登录 | 17:27:57 | 登录与后端身份校验通过 |
| A 初始读取 | 17:28:06 | 1 条，全部属于 A |
| A 写入后读取 | 17:28:10 / 17:28:15 | 写入读取通过，增加为 2 条，全部属于 A |
| B 登录及初始读取 | 17:28:43 / 17:28:58 | 登录通过，1 条，全部属于 B；没有显示 A 已存在的 2 条 |
| B 写入后读取 | 17:29:01 / 17:29:04 | 写入读取通过，增加为 2 条，全部属于 B |
| 切回 A 登录及读取 | 17:29:30 / 17:29:33 | 登录通过，仍为 2 条，全部属于 A；没有显示 B 的记录 |

结论：GitHub 同步 → Pages 发布 → Supabase 认证 → 私有数据写入读取的基础闭环验收完成，跨账户读取隔离符合预期，可进入 P1。
测试读取请求没有前端 user_id 过滤，隔离由数据库权限策略实现；页面额外校验可见记录的归属。

验收边界：

- 已验证注册关闭配置，未发送实际 signup 请求；后续 P2 使用独立测试地址做拒绝测试。
- 已验证本人写入与跨账户读取隔离，伪造他人 user_id 的写入拒绝尚未实测，纳入 P2。
- 已退出并切换账户，但未独立重放旧 access token 来验证失效；不承诺退出立即撤销所有已签发 JWT。
- 尚未验证正式会话持久化、过期刷新、习惯/奖励业务表、离线和 iPhone PWA。
- 测试探针保留供以后回归；不自动删除测试账户或记录。

## Pages 配置指南

1. 打开 https://github.com/BillWang2002/Habitify/settings/pages ，在 Build and deployment → Source 选择 GitHub Actions。无需新建额外部署工作流。
2. 打开 https://github.com/BillWang2002/Habitify/settings/variables/actions ，在 Repository variables 添加 SUPABASE_URL 和 SUPABASE_PUBLISHABLE_KEY；值使用已有公开连接参数，不包含 KEY= 前缀。
3. 不添加 secret key、数据库密码或 JWKS URL；本流程无需这些参数。
4. 打开 https://github.com/BillWang2002/Habitify/actions/workflows/pages.yml ，点击 Run workflow，选择 main 后运行。仅修改变量不会自动触发部署。
5. 确认 build 与 deploy 都成功，不能把 deploy skipped 当作发布成功。
6. 以 Pages 设置或部署输出中的网址为准。预期默认地址 https://billwang2002.github.io/Habitify/ ，在真实请求验证前不标记已发布。
7. 验证正式网页资源、部署版本和健康检查；再次登录、写入、跨账户读取，完成 L2/L5。

## 用户需要提供或操作的内容

1. GitHub：确认仓库网址与拥有者；创建仓库、登录和必要授权由用户自己的账户完成。
2. Supabase：确认项目创建，提供 Project URL 与 publishable key；数据库密码自行保管。
3. 在 SQL Editor 执行本项目提供的迁移文件，关闭公开注册，添加两个专用测试账户。
4. 在 GitHub 仓库 Settings → Pages 中选择 GitHub Actions。
5. GitHub Actions 变量设置 SUPABASE_URL 与 SUPABASE_PUBLISHABLE_KEY；它们会出现在网页中，不是管理密钥。
6. 测试账户密码仅在登录页面输入，不发到聊天、不写入仓库。

若仓库为私有，先确认当前 GitHub 方案支持 Pages。公开仓库中不得包含真实用户记录和管理凭据。

## 配置及发布

- 本地复制 config.example.json 为 config.local.json，填入公开参数；此文件不提交。
- config.example.json 与仓库文件中不填写 secret/service_role。
- npm run dev 启动通信页，npm run build 生成 dist，npm test 验证基础配置保护。
- npm run check:backend 使用本地公开配置检查真实认证、JWKS、关闭注册设置、health RPC 与匿名 RPC/表访问拒绝路径，任何未通过项令命令失败。
- GitHub Actions 从仓库变量生成 dist/config.json，仅上传 dist。
- 变量未齐备时基础检查仍执行，但跳过构建发布；配置齐备后才发布可连接的通信页。
- 相对路径适配仓库子路径，不引入 Service Worker 缓存，便于排查首轮部署。
- 首轮权限探针使用独立表，不产生真实习惯记录或金币。
- API 错误不展示令牌与原始敏感响应；身份和探针由账户权限限定。
- 初次测试时只在内存中保存登录状态，刷新后重新登录；正式会话管理在业务阶段实现。

## 验收证据

记录：测试日期、环境/网址、部署提交版本、检查项目、通过/失败/未验证、下一步。
不记录密码、完整令牌、管理密钥或测试账户完整个人信息。

检查不仅限于成功：

- 配置遗漏时显示未配置，不能显示成功。
- URL/公开 key 错误时显示失败，不能使用模拟结果兜底。
- 登录失败不能继续写数据；匿名身份调用私有接口被拒绝。
- A 写入后 B 不能读到，即使主动取消前端过滤也应受 RLS 约束。
- 不主动创建真实未授权账户来试注册；选择独立测试邮箱做一次拒绝验证，并检查后台没有新增账户。
- 发布地址打开后验证资源加载及实际跨域调用，确认完整链路。

参考：[GitHub Pages 配置](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)、[自动部署](https://docs.github.com/en/get-started/start-your-journey/deploying-your-website-automatically)、[Supabase 函数](https://supabase.com/docs/guides/database/functions)、[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)。
