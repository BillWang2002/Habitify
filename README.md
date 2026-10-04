# Habitify

个人与小范围使用的打卡管理 PWA，采用 GitHub Pages + Supabase。
基础通信与登录验收已完成，用户报告 iOS PWA 验证通过。主界面与打卡前端第一至第七版已验收归档，当前实施真实打卡持久化与金币，进度/部署/验收见 DATA.md；完整离线业务尚未实现。

## 当前内容

- 正式登录页：成长冒险＋电脑分屏、邮箱密码、持久会话、当前会话退出；首轮 iOS/电脑登录验收通过（用户报告）；PWA 可安装基础已接入，用户报告独立窗口验收通过，完整离线业务待完成。
- 独立通信页：/diagnostics/，公共 API、身份、私有探针读写、匿名拒绝检查；仅内存会话。
- Supabase 迁移：基础通信；新增打卡、记录、金币流水和受限交易 RPC，配套 habits Edge API。发布与验收见 DATA.md。
- GitHub Actions：基础检查与 Pages 发布。

## 本地运行

需要 Node.js 22 或更新版本，使用 npm ci 安装官方客户端与打包工具。

```sh
npm ci
npm test
npm run build
npm run dev
npm run check:backend
```

浏览器打开 http://127.0.0.1:5173/Habitify/ ，按正式子路径检查 PWA。开发服务启动时构建 dist；修改后重新运行 npm run build 或重启服务，有更新提示时点击更新。
复制 config.example.json 为 config.local.json，填入 Supabase Project URL 和 `sb_publishable_` 开头的公开 key。
后端未配置时，页面明确显示未连接。禁止填写管理密钥或密码。

## 云端配置

1. 在 Supabase 新项目中执行 supabase/migrations/202610030001_infrastructure.sql 一次。
2. 关闭公开注册，管理员添加两个测试账户。
3. GitHub Settings → Pages → Source 选择 GitHub Actions。
4. Settings → Secrets and variables → Actions → Variables 添加 SUPABASE_URL 与 SUPABASE_PUBLISHABLE_KEY。
5. 在 Actions 手动运行 Deploy Habitify，或推送 main。

当前打卡业务还需按 [DATA.md](./DATA.md) 部署第二个迁移与 habits API；仅执行基础迁移不能提供业务保存。

后端变量未齐备时，Actions 运行基础检查并跳过发布；齐备后构建校验参数并部署。
仅发布 dist，不发布项目文档、SQL 或本地配置。

## 项目文档

- [业务数据接入与部署](./DATA.md)
- [已确认金币规则](./COINS.md)

- [需求与立项](./CODEX.md)
- [基础架构与验收](./INFRASTRUCTURE.md)
- [开发规范](./DEVELOPMENT.md)
- [阶段计划](./ROADMAP.md)
- [决策记录](./DECISIONS.md)
- [后续后台管理规划](./ADMIN.md)
- [登录业务与前端方案](./AUTH.md)
- [PWA 安装与验收](./PWA.md)
- [主界面与打卡设计](./HOME.md)
- [主界面与打卡前端阶段归档（第一至第七版）](./docs/archive/2026-10-03-home-checkin-v7.md)

所有“通过”状态须有对应真实验证，不以文件准备完成代替云端验收。

统计第一版：行动概览、月历、打卡统计和柱形/累计折线；口径、部署及验收见 [STATS.md](./STATS.md)。

当前前端优化与“今日打卡”名称、嫩芽勾选图标说明见 [UI-POLISH.md](./UI-POLISH.md)。
