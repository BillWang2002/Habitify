import test from 'node:test';import assert from 'node:assert/strict';
import {defaultAppearance} from '../web/appearance-model.js';
import {readLoadingAppearance,writeLoadingAppearance,clearLoadingAppearance} from '../web/appearance-loading.js';
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};};
test('启动外观仅保存白名单装扮信息，并按应用路径隔离和退出清除',()=>{
 const s=storage(),a={theme:'lumi',background:'garden',surface:'glass',mode:'dark',avatar:'lumi',email:'private@example.test',token:'private'};
 writeLoadingAppearance(a,s,'/Habitify/');
 assert.deepEqual(readLoadingAppearance(s,'/Habitify/'),{theme:'lumi',background:'garden',surface:'glass',mode:'dark',avatar:'default'});
 assert.deepEqual(readLoadingAppearance(s,'/other/'),defaultAppearance);
 const serialized=[...s.data.values()][0];assert.equal(serialized.includes('private'),false);assert.equal(serialized.includes('avatar'),false);
 clearLoadingAppearance(s,'/Habitify/');assert.deepEqual(readLoadingAppearance(s,'/Habitify/'),defaultAppearance);
});
test('损坏与旧格式缓存回退，外部图片和无效搭配不进入启动背景',()=>{
 const s=storage(),key='habitify-loading-appearance:/Habitify/';
 for(const bad of ['{','null',JSON.stringify({version:2,settings:{theme:'lumi'}})]){s.setItem(key,bad);assert.deepEqual(readLoadingAppearance(s,'/Habitify/'),defaultAppearance);}
 s.setItem(key,JSON.stringify({version:1,settings:{theme:'lumi',background:'https://external.test/x',surface:'unknown',mode:'unknown'}}));
 assert.deepEqual(readLoadingAppearance(s,'/Habitify/'),{theme:'lumi',background:'garden',surface:'paper',mode:'system',avatar:'default'});
});
test('禁用本地存储不阻止启动或退出',()=>{
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 assert.deepEqual(readLoadingAppearance(blocked,'/'),defaultAppearance);assert.doesNotThrow(()=>writeLoadingAppearance({theme:'lumi'},blocked,'/'));assert.doesNotThrow(()=>clearLoadingAppearance(blocked,'/'));
});
