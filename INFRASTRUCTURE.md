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
| L2 Pages | Actions 部署、公开网页地址 | 从正式网页打开诊断页及资源，版本与提交一致 | 待 L1 |
| L3 后端公共 API | 创建 Supabase 项目、运行迁移、设置公开连接参数 | health RPC 返回成功及服务端时间 | 待提供项目 |
| L4 登录与私有 API | 关闭公开注册、管理员创建两个测试账户 | 登录后返回本人身份，探针可写入读取；退出后私有访问被拒绝 | 待 L3 |
| L5 权限与完整链路 | 两账户验证、公开注册拒绝验证 | B 查不到 A 的探针；匿名不能操作；Pages 上完成登录读写 | 待 L2/L4 |

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
L1 与 L3 可准备，但前置结果未通过的完整链路不能声明完成。

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
