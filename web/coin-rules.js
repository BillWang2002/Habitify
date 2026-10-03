// Render the values returned by the trusted backend; no browser-side balance calculation.
export function coinRulesHtml(r) {
 if (!r) return '<p>金币规则暂时无法加载，请检查连接后重试。</p>';
 return `<div class="detail-panel"><h2>通过行动获得金币</h2><p>每个习惯当日达到目标，获得 <strong>${r.completion}</strong> 金币；当天首次达标额外获得 <strong>${r.first_action}</strong> 金币。</p><p>普通奖励每天最多 <strong>${r.daily_cap}</strong> 金币，包含首次达标奖励。达到上限后仍可正常记录行动。</p><p>数量型习惯只记录部分进度不会发币；至少一个习惯达标，今天才成为行动日。</p></div>
 <div class="detail-panel"><h2>连续行动奖励</h2><p>每连续 7 个行动日额外获得 <strong>${r.seven_day}</strong> 金币；每连续 30 个行动日额外获得 <strong>${r.thirty_day}</strong> 金币。</p><p>两个节点重叠时奖励叠加，连续奖励不占普通每日上限。漏一天会结束当前连续周期，不扣除此前有效奖励。</p></div>
 <div class="detail-panel"><h2>修正记录与重复操作</h2><p>同一习惯同一天不能重复赚取金币。撤销、降低到未达标或删除当天记录，会撤回不再成立的普通与连续奖励；再次达标只恢复应得金额。</p><p>其他习惯仍达标时，行动日继续成立。当天达标习惯减少后，会重新分配普通奖励，仍受每日上限约束。</p><p>创建习惯、登录和打开页面不发金币。归档保留已完成的记录；删除习惯清除当天进度，历史记录保留。</p></div>
 <div class="detail-panel"><h2>日期与后续功能</h2><p>奖励按账户时区和服务器日期结算，手机时钟不会改变奖励日期。本轮只开放当天在线打卡，补签和金币消费尚未开放。</p><p>补签后续不补发普通奖励；补签额度、价格与连续奖励恢复规则将在开放前说明。金币无真实货币价值。</p><p class="dialog-note">规则版本 ${r.version}</p></div>`;
}
