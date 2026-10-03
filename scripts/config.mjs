export function validateConfig(config, { required = false } = {}) {
  const { supabaseUrl = '', supabasePublishableKey = '' } = config;
  if (!supabaseUrl && !supabasePublishableKey && !required) return config;
  if (!supabaseUrl || !supabasePublishableKey) throw new Error('请同时填写 Project URL 和 publishable key。');
  const url = new URL(supabaseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('Project URL 必须是无凭据、路径或参数的 HTTPS 地址。');
  }
  if (!supabasePublishableKey.startsWith('sb_publishable_')) {
    throw new Error('通信页仅接受 sb_publishable_ 开头的公开 key，不接受管理 key 或旧版 JWT。');
  }
  return { supabaseUrl: url.origin, supabasePublishableKey };
}
