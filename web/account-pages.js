import { accountHeader } from './account-header.js';
import { iconSvg } from './theme.js';
const page = (route, title, parent, group, icon, heading, description) => `<section data-page="${route}" class="account-feature-page" hidden>${accountHeader({group,title,parent,parentLabel:parent === 'developer' ? '开发者模式' : '我的'})}<div class="account-feature-state"><span class="account-feature-icon" aria-hidden="true">${iconSvg(icon)}</span><span class="account-row-badge">即将开放</span><h2>${heading}</h2><p>${description}</p></div></section>`;
export function accountPagesHtml() {
 return page('inbox','收件箱','me','我的空间','inbox','消息会在这里与你相遇','公告、账户通知和反馈回复将在这里集中查看。消息服务尚未接入。')
  + page('feedback','意见反馈','me','工具与账户','feedback','让今日打卡更贴近你的节奏','这里将用于提交使用建议或遇到的问题，并在收件箱查看回复。反馈提交尚未开放。')
  + page('admin-login','开发人员登录','developer','后台管理','shield','后台管理入口','后台登录与管理权限尚未开放，当前账户不会因此获得管理权限。');
}
