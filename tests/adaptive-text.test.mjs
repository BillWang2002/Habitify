import test from 'node:test';import assert from 'node:assert/strict';
import {parseColor,compositeColor,chooseTextTone,contrast} from '../web/adaptive-text-model.js';
test('透明颜色合成保留实际背景，浅深背景自动选择可读字色',()=>{
 assert.deepEqual(parseColor('rgba(255, 253, 245, 0.45)'),[255,253,245,.45]);assert.deepEqual(parseColor('transparent'),[0,0,0,0]);
 assert.deepEqual(compositeColor([255,255,255,.5],[0,0,0]),[127.5,127.5,127.5]);
 assert.equal(chooseTextTone([[250,240,210],[210,230,240]]),'dark');assert.equal(chooseTextTone([[30,24,18],[50,40,28]]),'light');
 assert.equal(contrast([0,0,0],[255,255,255]),21);
});
test('跨越背景明暗边界时稳定旧颜色，明确进入另一背景后切换',()=>{
 const near=[130,130,130];assert.equal(chooseTextTone([near],'dark'),'dark');assert.equal(chooseTextTone([near],'light'),'light');
 assert.equal(chooseTextTone([[255,255,255]],'light'),'dark');assert.equal(chooseTextTone([[0,0,0]],'dark'),'light');
 assert.equal(chooseTextTone([],'light'),'light');
});
