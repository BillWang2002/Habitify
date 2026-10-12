# 反馈邮件配置与验收

2026-10-12。状态：代码已准备，未连接邮箱/配置真实凭据/部署调度或发信。

## 首版候选：EmailJS连接个人邮箱

当前无自有域名，使用EmailJS适配器用于低频管理员通知。免费额度与限制见FEEDBACK.md。服务最终选择、账户可用性和服务端调用必须真实验证；若选其他服务，仅替换worker发信适配器，反馈/任务数据结构不变。

用户自行创建EmailJS账号并完成条款确认，连接用于通知的Gmail邮箱、完成其授权。建议使用专门通知邮箱。不要在聊天粘贴邮箱密码、授权令牌或私钥。邮箱连接涉及第三方发信权限，连接前需明确授权范围；当前只准备代码，没有执行连接。

## 模板

创建一个管理员通知模板，固定发信服务和管理员收件地址。若To Email用变量，必须为`{{to_email}}`，由服务端固定配置，不能由成员提交。不要设置外部自动回复或根据正文改变收件人。

主题建议：`今日打卡 · 新反馈 · {{feedback_title}}`。

HTML正文只使用以下双括号变量，用户文本已在worker内转义：

- `feedback_id`：反馈编号，可在后台搜索。
- `feedback_category`：分类。
- `feedback_title`：标题。
- `feedback_summary`：正文前200字。
- `feedback_created_at`：服务端提交时间。
- `admin_url`：固定后台反馈页链接，进入后仍需管理员登录。

不要在模板中使用用户输入构造任意HTML/链接或注入邮箱头。无完整正文、成员邮箱、内部备注或管理员授权令牌。EmailJS模板和邮箱仍可能保留发信记录，按需要在其后台设置记录保留/跟踪。

## Supabase Edge Function Secrets

| 名称 | 用途 |
| --- | --- |
| EMAILJS_SERVICE_ID | 已连接邮箱服务ID |
| EMAILJS_TEMPLATE_ID | 固定管理员通知模板ID |
| EMAILJS_PUBLIC_KEY | EmailJS账户公钥（此实现也仅放服务端） |
| EMAILJS_PRIVATE_KEY | EmailJS服务端私钥，需核对其安全设置允许使用 |
| ADMIN_NOTIFICATION_EMAIL | 固定管理员收件邮箱，独立于后台登录身份 |
| FEEDBACK_MAIL_WORKER_KEY | 随机32字节、以64位小写十六进制表示的独立任务调用凭据，不能用普通成员JWT或后台session代替 |

若账户要求开启非浏览器调用/私钥授权，按EmailJS当前安全设置配置，先验证实际可用性；不能将私钥写入GitHub配置、前端config.json或仓库。凭据缺失时worker返回EMAIL_NOT_CONFIGURED且不领取任务。参考[REST接口](https://www.emailjs.com/docs/rest-api/send/)、[私钥配置](https://www.emailjs.com/docs/sdk/options/)。

## 分步上线

1. 用户授权后执行012，部署admin/habits更新；核对本人/后台RPC及匿名拒绝，先发布经过通信验收的反馈前端。邮件未配置时任务保持待发送，可在后台查看。
2. 用户完成EmailJS服务/模板/授权及Secrets配置；部署feedback-mail（打包脚本scripts/build-feedback-mail.mjs，函数以独立worker key验证调用）。验证错误凭据/匿名无法调用，空队列不发送。
3. 用无私人信息的测试反馈核对一次真实投递；服务接受和管理员实际收件分别记录，不以200 OK代替收件验证。
4. 在Supabase启用pg_cron、pg_net，Vault中加入名为habitify_feedback_mail_worker_key的秘密，值与服务端worker密钥相同。配置后执行supabase/setup/feedback_mail_schedule.sql，定时补偿任务在关闭浏览器后继续运行。脚本不包含秘密，不在012迁移中自动执行。
5. 验证429/额度耗尽、租约过期/超时的状态；状态uncertain不自动重发，管理员先看邮件服务记录后确认重发，可能产生重复邮件。明确失败修复配置后可重新排队。

调度需完整配置后启用；未经验证不能宣称“关闭页面也能自动重试”。修改服务或收件人后检查积压任务，启用worker会发送队列中已有反馈摘要。

## 暂停与故障处理

暂停发信可停用名为habitify-feedback-mail的Cron任务并移除/轮换worker密钥；反馈仍可提交和后台处理，邮件任务保留。不要为了暂停发信关闭反馈数据库或撤销普通本人权限。

前端出现提交结果未知时用原请求继续确认，不重新生成请求ID；管理员回复结果未知同理。已确认回复成功但详情刷新失败时刷新查看，回复输入已清空，不能重复发送。实际授权或密钥不得出现在错误信息/日志/截图中。
