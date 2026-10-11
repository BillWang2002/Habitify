import {defaultAppearance,normalizeAppearance} from './appearance-model.js';
// Cosmetic startup hint only: no identity, avatar, token, or private account data.
const key=path=>`habitify-loading-appearance:${path}`;
export function readLoadingAppearance(storage=localStorage,path=location.pathname){
 try{const entry=JSON.parse(storage.getItem(key(path)));return entry?.version===1&&entry.settings&&typeof entry.settings==='object'?normalizeAppearance({...entry.settings,avatar:'default'}):{...defaultAppearance};}catch{return {...defaultAppearance};}
}
export function writeLoadingAppearance(value,storage=localStorage,path=location.pathname){
 const {theme,background,surface,mode}=normalizeAppearance(value);
 try{storage.setItem(key(path),JSON.stringify({version:1,settings:{theme,background,surface,mode}}));}catch{}
}
export function clearLoadingAppearance(storage=localStorage,path=location.pathname){try{storage.removeItem(key(path));}catch{}}
