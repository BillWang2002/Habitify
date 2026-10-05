import { iconSvg } from './theme.js';
// Static account-page labels only; keep the same header across app and diagnostics.
export function accountHeader({group,title,parent='me',parentLabel='我的',href=`#/${parent}`}) {
 return `<header class="detail-header account-header"><a href="${href}" class="back-link" aria-label="返回${parentLabel}">${iconSvg('back')}</a><div class="account-header-copy"><p class="date-label">${group}</p><h1>${title}</h1></div></header>`;
}
