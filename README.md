# Habitify

个人与小范围使用的习惯管理 PWA，采用 GitHub Pages + Supabase。
目前处于基础架构配置阶段，尚未实现习惯、金币等业务。

## 当前内容

- 静态通信页：公共 API、账户身份、私有探针读写、匿名拒绝检查。
- Supabase 迁移：健康检查 RPC、私有身份 RPC、RLS 隔离的测试探针。
- GitHub Actions：基础检查与 Pages 发布。

## 本地运行

需要 Node.js 22 或更新版本，无需安装第三方运行依赖。

```sh
npm test
npm run build
npm run dev
```

浏览器打开 http://127.0.0.1:5173 。
复制 config.example.json 为 config.local.json，填入 Supabase Project URL 和 `sb_publishable_` 开头的公开 key。
后端未配置时，页面明确显示未连接。禁止填写管理密钥或密码。

## 云端配置

1. 在 Supabase 新项目中执行 supabase/migrations/202610030001_infrastructure.sql 一次。
2. 关闭公开注册，管理员添加两个测试账户。
3. GitHub Settings → Pages → Source 选择 GitHub Actions。
4. Settings → Secrets and variables → Actions → Variables 添加 SUPABASE_URL 与 SUPABASE_PUBLISHABLE_KEY。
5. 在 Actions 手动运行 Deploy communication page，或推送 main。

后端变量未齐备时，Actions 运行基础检查并跳过发布；齐备后构建校验参数并部署。
仅发布 dist，不发布项目文档、SQL 或本地配置。

## 项目文档

- [需求与立项](./CODEX.md)
- [基础架构与验收](./INFRASTRUCTURE.md)
- [开发规范](./DEVELOPMENT.md)
- [阶段计划](./ROADMAP.md)
- [决策记录](./DECISIONS.md)

所有“通过”状态须有对应真实验证，不以文件准备完成代替云端验收。
