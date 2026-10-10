export const defaultAppearance=Object.freeze({theme:'growth',background:'plain',surface:'paper',avatar:'default',mode:'system'});
export const themes=[{id:'growth',name:'自然成长',description:'熟悉的深浅绿，让行动回到自己的节奏。',backgrounds:[['plain','简洁底色']],surfaces:[['paper','柔和卡片']]},{id:'lumi',name:'星灯旅人 · 露米',description:'跟着一盏星灯，把今天的小事变成旅途。',backgrounds:[['garden','月夜庭院'],['sky','简洁星空']],surfaces:[['paper','星笺纸感'],['glass','月光玻璃']]}];
export const avatars=[['default','默认头像'],['lumi','露米'],['star','星灯徽章']];
export function normalizeAppearance(value={}){
 const theme=themes.find(t=>t.id===value.theme)||themes[0];
 return {theme:theme.id,background:theme.backgrounds.some(([id])=>id===value.background)?value.background:theme.backgrounds[0][0],surface:theme.surfaces.some(([id])=>id===value.surface)?value.surface:theme.surfaces[0][0],avatar:avatars.some(([id])=>id===value.avatar)?value.avatar:'default',mode:['system','light','dark'].includes(value.mode)?value.mode:'system'};
}
export const sameAppearance=(a,b)=>JSON.stringify(normalizeAppearance(a))===JSON.stringify(normalizeAppearance(b));
export function selectTheme(current,id){const theme=themes.find(t=>t.id===id)||themes[0];return normalizeAppearance({...current,theme:theme.id,background:theme.backgrounds[0][0],surface:theme.surfaces[0][0]});}
