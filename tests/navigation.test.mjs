import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavigation } from '../web/navigation.js';
function fixture(initial='habits') {
  const listeners=new Map(), stack=[{hash:`#/${initial}`,state:null}]; let index=0, view={filter:'pending',scroll:320}, calls=[];
  const host={location:{hash:`#/${initial}`},addEventListener(name,fn){listeners.set(name,fn);}};
  function move(amount) { index+=amount; host.location.hash=stack[index].hash; listeners.get('popstate')?.(); listeners.get('hashchange')?.(); }
  host.history={get state(){return stack[index].state;},scrollRestoration:'auto',replaceState(state,unused,hash){stack[index]={state,hash};host.location.hash=hash;},pushState(state,unused,hash){stack.splice(index+1);stack.push({state,hash});index++;host.location.hash=hash;},back(){move(-1);},forward(){move(1);}};
  const navigation=createNavigation({host,normalize:path=>['habits','habit/water'].includes(path)?path:'habits',readView:()=>({...view}),onChange(path,meta){calls.push({path,...meta});view=meta.view || {filter:view.filter,scroll:0};}});
  return {navigation,host,calls,stack,event:name=>listeners.get(name)?.(),setView:next=>view=next,getView:()=>view};
}
test('详情系统返回恢复筛选与滚动；popstate/hashchange重复事件只渲染一次',()=>{
  const f=fixture(); f.navigation.start('habits'); f.setView({filter:'pending',scroll:320});
  f.navigation.navigate('habit/water'); f.setView({filter:'pending',scroll:120});
  const count=f.calls.length; f.host.history.back();
  assert.equal(f.calls.length,count+1); assert.equal(f.calls.at(-1).source,'history'); assert.equal(f.calls.at(-1).path,'habits');
  assert.deepEqual(f.getView(),{filter:'pending',scroll:320});
  f.host.history.forward(); assert.equal(f.calls.at(-1).path,'habit/water'); assert.equal(f.getView().scroll,120);
});
test('左上角返回复用上一条记录，反复进入详情不会累积主界面历史',()=>{
  const f=fixture();f.navigation.start('habits');
  for(let i=0;i<3;i++){f.navigation.navigate('habit/water');f.navigation.back();}
  assert.equal(f.stack.length,2);assert.equal(f.host.location.hash,'#/habits');
});
test('直接打开详情没有已知父记录时替换返回首页，失效路由被归一',()=>{
  const f=fixture('habit/water');f.navigation.start('habit/water');f.navigation.back();
  assert.equal(f.stack.length,1);assert.equal(f.host.location.hash,'#/habits');
  f.navigation.navigate('habit/missing');assert.equal(f.stack.length,1);
});
test('退出后历史事件不呈现界面，重新进入不恢复前账户视图',()=>{
  const f=fixture();f.navigation.start('habits');f.setView({filter:'done',scroll:500});f.navigation.navigate('habit/water');f.navigation.stop({reset:true});
  const count=f.calls.length;f.host.history.back();assert.equal(f.calls.length,count);
  f.setView({filter:'all',scroll:0});f.navigation.start('habits');assert.equal(f.getView().filter,'all');assert.equal(f.getView().scroll,0);
  const state=f.host.history.state;assert.deepEqual(Object.keys(state.habitifyNavigation).sort(),['id','session']);
});
