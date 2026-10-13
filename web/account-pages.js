import {inboxHtml} from './inbox.js';
import {feedbackHtml} from './feedback.js';
import {accountHeader} from './account-header.js';
import {iconSvg} from './theme.js';
export function accountPagesHtml() {
 return inboxHtml()+feedbackHtml()+`<section data-page="inventory" hidden>${accountHeader({group:'我的空间',title:'我的物品'})}<div class="account-feature-state"><span class="account-feature-icon" aria-hidden="true">${iconSvg('inventory')}</span><h2>为你的物品留一个位置</h2><p>物品功能后续开放。已获得的装扮、物品与奖励将在这里展示。</p></div></section>`;
}
