export const defaultAppearance=Object.freeze({theme:'growth',background:'plain',surface:'paper',avatar:'growth',mode:'system'});
export const themes=[
 {id:'growth',name:'自然成长',description:'熟悉的深浅绿，让行动回到自己的节奏。',backgrounds:[['plain','简洁底色']],surfaces:[['paper','柔和卡片']],avatars:[['growth','嫩芽']]},
 {id:'lumi',name:'星灯旅人',description:'跟着一盏星灯，把今天的小事变成旅途。',backgrounds:[['garden','月夜庭院'],['meadow','晨雾花野'],['harbor','暮色海港'],['library','星图书房'],['sky','简洁星空']],surfaces:[['paper','星笺纸感'],['glass','月光玻璃']],avatars:[['lumi','月夜露米'],['lumi-meadow','花野露米'],['lumi-harbor','海风露米'],['lumi-library','书房露米']]},
 {id:'duckyo',name:'小刘鸭',description:'小刘鸭来袭！',backgrounds:[['duckyo-study','专注写字'],['duckyo-work','打工小鸭'],['duckyo-phone','手机时光'],['duckyo-snack','零食片刻'],['duckyo-cake','蛋糕心情']],surfaces:[['paper','奶油纸感'],['glass','轻透卡片']],avatars:[['duckyo-study','专注小鸭'],['duckyo-work','猫耳小鸭'],['duckyo-phone','手机小鸭'],['duckyo-snack','零食小鸭'],['duckyo-cake','蛋糕小鸭']]}
];
export const backgroundAssets=Object.freeze(Object.fromEntries([...['garden','meadow','harbor','library'].map(id=>[id,`./themes/lumi/${id}.webp`]),...['study','work','phone','snack','cake'].map(id=>[`duckyo-${id}`,`./themes/duckyo/${id==='work'?'work-v2':id}.webp`])]));
export const avatarAssets=Object.freeze({lumi:'./themes/lumi/avatar.webp','lumi-meadow':'./themes/lumi/avatar-meadow.webp','lumi-harbor':'./themes/lumi/avatar-harbor.webp','lumi-library':'./themes/lumi/avatar-library.webp',...Object.fromEntries(['study','work','phone','snack','cake'].map(id=>[`duckyo-${id}`,`./themes/duckyo/avatar-${id==='work'?'work-v2':id}.webp`]))});
export const themeCoverAssets=Object.freeze({lumi:'./themes/lumi/garden.webp',duckyo:'./themes/duckyo/cover-v2.webp'});
const duckyoChromeColors={"duckyo-study":"#9ad7dc","duckyo-work":"#c8daf0","duckyo-phone":"#ffefd6","duckyo-snack":"#a7c8cf","duckyo-cake":"#f8eeb1"};
export function themeChromeColor(theme,dark=false,background='duckyo-study'){if(theme==='duckyo'&&!dark)return duckyoChromeColors[background]||duckyoChromeColors['duckyo-study'];return ({growth:['#245b43','#111e18'],lumi:['#273b60','#111a30'],duckyo:['#c8daf0','#211c17']}[theme]||['#245b43','#111e18'])[dark?1:0];}
export const backgroundAvatars=Object.freeze({plain:'growth',garden:'lumi',meadow:'lumi-meadow',harbor:'lumi-harbor',library:'lumi-library',sky:'lumi',...Object.fromEntries(['study','work','phone','snack','cake'].map(id=>[`duckyo-${id}`,`duckyo-${id}`]))});
export function normalizeAppearance(value={}){
 const theme=themes.find(t=>t.id===value.theme)||themes[0];
 const background=theme.backgrounds.some(([id])=>id===value.background)?value.background:theme.backgrounds[0][0];
 return {theme:theme.id,background,surface:theme.surfaces.some(([id])=>id===value.surface)?value.surface:theme.surfaces[0][0],avatar:backgroundAvatars[background],mode:['system','light','dark'].includes(value.mode)?value.mode:'system'};
}
export const sameAppearance=(a,b)=>JSON.stringify(normalizeAppearance(a))===JSON.stringify(normalizeAppearance(b));
export function selectTheme(current,id){const theme=themes.find(t=>t.id===id)||themes[0];return normalizeAppearance({...current,theme:theme.id,background:theme.backgrounds[0][0],surface:theme.surfaces[0][0]});}
