import test from 'node:test';import assert from 'node:assert/strict';
import {keyboardGeometry} from '../web/keyboard-viewport.js';
const base={baseHeight:844,height:844,width:390,baseWidth:390,focused:true};
test('键盘判定需聚焦且明显缩小可见区域；浏览器栏和缩放不误判',()=>{
 assert.equal(keyboardGeometry({...base,height:500}).open,true);
 assert.equal(keyboardGeometry({...base,height:790}).open,false);
 assert.equal(keyboardGeometry({...base,height:500,focused:false}).open,false);
 assert.equal(keyboardGeometry({...base,height:500,scale:1.4}).open,false);
 assert.equal(keyboardGeometry({...base,height:390,width:844}).open,false);
});
test('覆盖式键盘几何与WebKit可见区域均保留输入可用空间',()=>{
 assert.deepEqual(keyboardGeometry({...base,keyboardHeight:344}),{open:true,height:500,top:0});
 assert.deepEqual(keyboardGeometry({...base,height:500,offsetTop:80}),{open:true,height:500,top:80});
});
