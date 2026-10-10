import {accountHeader} from './account-header.js';
import {iconSvg,setIconTheme,refreshThemeIcons} from './theme.js';
import {themes,avatars,defaultAppearance,normalizeAppearance,sameAppearance,selectTheme} from './appearance-model.js';
export const avatarHtml=id=>id==='lumi'?'<img src="./themes/lumi/avatar.webp" alt="露米头像" width="64" height="64">':iconSvg(id==='star'?'coins':'me');
function syncThemeColor(){const html=document.documentElement,dark=html.dataset.themeMode==='dark'||(html.dataset.themeMode!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);const color=html.dataset.theme==='lumi'?(dark?'#111a30':'#273b60'):(dark?'#111e18':'#245b43');document.querySelector('meta[name="theme-color"]')?.setAttribute('content',color);}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',syncThemeColor);
export function applyAppearance(value,root=document){const a=normalizeAppearance(value),html=document.documentElement;html.dataset.theme=a.theme;html.dataset.themeMode=a.mode;html.dataset.themeBackground=a.background;html.dataset.themeSurface=a.surface;syncThemeColor();setIconTheme(a.theme);refreshThemeIcons(root);const avatar=root.querySelector('#profile-avatar');if(avatar)avatar.innerHTML=avatarHtml(a.avatar);return a;}
export function appearanceHtml(){return `<section data-page="appearance" class="appearance-page" hidden>${accountHeader({group:'我的空间',title:'外观与头像'})}<p class="dialog-note">换一种风景，继续自己的节奏。预览后点击应用，装扮跟随账户保存。</p><div class="appearance-themes">${themes.map(t=>`<button type="button" class="theme-choice theme-choice-${t.id}" data-theme-choice="${t.id}" aria-pressed="false"><span class="theme-cover" aria-hidden="true">${t.id==='lumi'?'<img src="./themes/lumi/garden.webp" alt="" width="256" height="200">':'<span class="theme-growth-mark">✦</span>'}</span><span class="theme-choice-copy"><strong>${t.name}</strong><small>${t.description}</small></span><span class="theme-selected-mark" aria-hidden="true">✓</span></button>`).join('')}</div><div class="appearance-settings"><fieldset><legend>背景</legend><div id="appearance-backgrounds" class="appearance-options"></div></fieldset><fieldset><legend>卡片与弹窗</legend><div id="appearance-surfaces" class="appearance-options"></div></fieldset><fieldset><legend>头像</legend><div id="appearance-avatars" class="appearance-options appearance-avatars"></div></fieldset><fieldset><legend>显示模式</legend><div id="appearance-modes" class="appearance-options"></div></fieldset></div><div class="appearance-preview"><span class="appearance-preview-label">套装图案</span><div class="appearance-icon-sample">${['checkin','rewards','stats','me','leaf','book','water','walk','target','sun'].map(id=>`<span>${iconSvg(id)}</span>`).join('')}</div><p class="dialog-note">导航、操作图标和打卡图案跟随主题，已有打卡的名称、记录方式与数据保持。</p></div><p id="appearance-message" class="account-feedback" role="status" aria-live="polite"></p><div class="appearance-actions"><button type="button" id="appearance-reload" class="secondary">重新读取</button><button type="button" id="appearance-save" class="primary">应用外观</button></div><p class="appearance-note">两套外观在本次测试中免费使用。主题商店、头像上传与展示墙后续开放。</p></section>`;}
export function createAppearance(root,{request,preview=false,onChange=()=>{}}={}){
 const $=id=>root.querySelector(`#${id}`);let owner=null,epoch=0,saved={...defaultAppearance},draft={...saved},revision=0,loaded=preview,writing=false,visible=false,pending=null;
 root.addEventListener('error',event=>{const img=event.target;if(img?.tagName!=='IMG')return;if(img.getAttribute('src')==='./themes/lumi/avatar.webp')img.outerHTML=iconSvg('me');else if(img.getAttribute('src')==='./themes/lumi/garden.webp')img.hidden=true;},true);
 const key=id=>`habitify-appearance:${location.pathname}:${id}`;
 const cacheRead=id=>{try{const v=JSON.parse(localStorage.getItem(key(id)));return v&&v.version===1?normalizeAppearance(v.settings):null;}catch{return null;}};
 const cacheWrite=()=>{if(!preview&&owner)try{localStorage.setItem(key(owner),JSON.stringify({version:1,settings:saved}));}catch{}};
 const dirty=()=>!sameAppearance(saved,draft);
 function paint(){applyAppearance(draft,root);onChange(draft);}
 function render(){
  for(const button of root.querySelectorAll('[data-theme-choice]')){button.setAttribute('aria-pressed',String(button.dataset.themeChoice===draft.theme));button.disabled=writing||!loaded;}
  function options(id,field,list){$(id).replaceChildren();for(const [value,label] of list){const b=document.createElement('button');b.type='button';b.dataset.appearanceValue=value;b.setAttribute('aria-pressed',String(draft[field]===value));b.disabled=writing||!loaded;b.innerHTML=field==='avatar'?`<span class="appearance-avatar">${avatarHtml(value)}</span><span>${label}</span>`:label;b.onclick=()=>{draft={...draft,[field]:value};pending=null;paint();render();message('正在预览，点击应用后保存。');};$(id).append(b);}}
  const t=themes.find(t=>t.id===draft.theme);options('appearance-backgrounds','background',t.backgrounds);options('appearance-surfaces','surface',t.surfaces);options('appearance-avatars','avatar',avatars);options('appearance-modes','mode',[['system','跟随系统'],['light','浅色'],['dark','深色']]);
  $('appearance-save').disabled=writing||!loaded||!dirty();$('appearance-save').textContent=writing?'正在保存…':'应用外观';$('appearance-reload').disabled=writing;
 }
 function message(text){$('appearance-message').textContent=text;}
 async function load(){if(preview)return;const token=epoch;try{const data=await request({op:'appearance-get'});if(token!==epoch||dirty()||writing)return;if(!Number.isSafeInteger(data.revision)||data.revision<0)throw new Error('外观数据暂不可用。');const current=normalizeAppearance(data.settings);revision=data.revision;saved=current;draft={...current};loaded=true;pending=null;cacheWrite();paint();render();message('当前外观已与账户同步。');}catch(error){if(token===epoch){message(error.message);render();}}}
 for(const button of root.querySelectorAll('[data-theme-choice]'))button.onclick=()=>{draft=selectTheme(draft,button.dataset.themeChoice);pending=null;paint();render();message('正在预览，点击应用后保存。');};
 $('appearance-reload').onclick=()=>{if(writing)return;if(preview){draft={...saved};loaded=true;paint();render();message('公开预览不读取账户。');return;}draft={...saved};pending=null;loaded=false;paint();render();message('正在读取账户外观…');load();};
 $('appearance-save').onclick=async()=>{
  if(writing||!loaded||!dirty())return;const token=epoch;const value=normalizeAppearance(draft);writing=true;render();message('正在保存你的装扮…');
  try{const payload=pending||{op:'appearance-set',settings:value,requestId:crypto.randomUUID(),expectedRevision:revision};pending=payload;const data=preview?{settings:value,revision:revision+1}:await request(payload);if(token!==epoch)return;saved=normalizeAppearance(data.settings);draft={...saved};revision=data.revision;pending=null;cacheWrite();paint();message(preview?'公开预览已应用，本次选择不会保存到账户。':'外观已保存，其他设备下次进入时同步。');}
  catch(error){if(token===epoch){if(error.code!=='NETWORK_ERROR')pending=null;if(error.code==='STALE_DATA')loaded=false;message(error.message);}}
  finally{if(token===epoch){writing=false;render();}}
 };
 return {
  enter(user){if(owner===user.id&&loaded){if(!dirty()&&!writing)load();return;}++epoch;owner=user.id;writing=false;pending=null;revision=0;loaded=preview;saved=preview?{...defaultAppearance}:cacheRead(owner)||{...defaultAppearance};draft={...saved};paint();render();message(preview?'公开预览 · 不保存个人数据':'正在读取账户外观…');load();},
  show(){visible=true;render();},
  hide(){if(!visible)return;visible=false;if(!writing){draft={...saved};pending=null;paint();render();}},
  clear(reset=false){++epoch;if(reset&&owner&&!preview)try{localStorage.removeItem(key(owner));}catch{}owner=null;writing=false;loaded=preview;pending=null;visible=false;saved={...defaultAppearance};draft={...saved};applyAppearance(saved,root);render();message('');},
  busy:()=>writing||(visible&&dirty()),
  refresh:()=>{if(!writing&&!dirty())load();}
 };
}
