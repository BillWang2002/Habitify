import {backgroundAssets} from './appearance-model.js';
import {parseColor,compositeColor,chooseTextTone} from './adaptive-text-model.js';
const selectors=[
 '.page-title h1','.date-label','.week-strip button','.habit-toolbar h2','.habit-info','.recent-days','.habit-more',
 '.growth-copy','.growth-progress','.habit-empty','.archive-empty','.account-feature-state','.module-intro','.module-item',
 '.profile-card>div','.profile-status','.account-facts','.profile-metrics','.account-row-copy','.account-section>h2',
 '.account-header-copy','.account-feedback','.habits-footnote','.detail-panel','.stats-overview article','.message-open',
 '.appearance-page>.dialog-note','.appearance-theme-hint','.appearance-linked-avatar p','.appearance-note',
 '.habit-dialog .dialog-heading h2','.habit-dialog .dialog-heading button','.habit-dialog label','.habit-dialog legend','.habit-dialog .dialog-note',
 '.habit-dialog .message','.manage-actions button','#restoring h2','#restoring p'
].join(',');
function gradientColours(value){return [...value.matchAll(/rgba?\([^)]+\)/g)].map(match=>parseColor(match[0]));}
function visibleRect(element){const r=element.getBoundingClientRect();return element.getClientRects().length&&r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth?r:null;}
function samplePoints(r){const points=[];for(const y of [.25,.5,.75])for(const x of [.15,.5,.85])points.push([r.left+r.width*x,r.top+r.height*y]);return points;}
export function initAdaptiveText(){
 const html=document.documentElement,bitmaps=new Map(),tracked=new Set();let timer,settled,frame=0,disposed=false;
 const dark=()=>html.dataset.themeMode==='dark'||(html.dataset.themeMode!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);
 function bitmap(path){
  if(!bitmaps.has(path)){
   const image=new Image();const entry={image,data:null};bitmaps.set(path,entry);
   image.onload=()=>{if(disposed)return;try{const canvas=document.createElement('canvas');canvas.width=192;canvas.height=Math.round(192*image.naturalHeight/image.naturalWidth);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,canvas.width,canvas.height);entry.data=ctx.getImageData(0,0,canvas.width,canvas.height);schedule();}catch{/* Trusted flat fallback and text halo still work. */}};
   image.onerror=()=>schedule();image.src=path;
  }
  return bitmaps.get(path);
 }
 function clean(){for(const element of tracked)element.removeAttribute('data-adaptive-text');tracked.clear();html.removeAttribute('data-adaptive-text-status');}
 function update(){
  frame=0;if(disposed)return;if(html.dataset.theme!=='duckyo'){clean();return;}
  for(const element of tracked)if(!element.isConnected){tracked.delete(element);}
  const path=backgroundAssets[html.dataset.themeBackground],entry=path?bitmap(path):null;
  html.dataset.adaptiveTextStatus=entry?.data?'sampled':'fallback';
  const cache=new Map(),style=element=>{if(!cache.has(element))cache.set(element,getComputedStyle(element));return cache.get(element);};
  const open=document.querySelector('.habit-dialog[open]');
  const panelSelectors='.habit-card,.growth-card,.habit-empty,.archive-empty,.my-account-card,.account-list,.account-feature-state,.module-intro,.module-item,.detail-panel,.stats-overview article,.appearance-settings,.appearance-preview,.message-card,.app-nav,.habit-filters';
  const underlying=open?[...document.querySelectorAll(panelSelectors)].filter(el=>!open.contains(el)).map(el=>({element:el,rect:visibleRect(el)})).filter(item=>item.rect).reverse():[];
  function paintLayers(colour,layers,x){for(const layer of layers){const css=style(layer);colour=compositeColor(parseColor(css.backgroundColor),colour);
   if(css.backgroundImage.startsWith('linear-gradient')){const stops=gradientColours(css.backgroundImage);if(stops.length){const b=layer.getBoundingClientRect(),t=Math.max(0,Math.min(1,(x-b.left)/Math.max(1,b.width)));const first=stops[0],last=stops.at(-1);colour=compositeColor(first.map((v,i)=>v*(1-t)+last[i]*t),colour);}}
  }return colour;}

  for(const element of document.querySelectorAll(selectors)){
   const r=visibleRect(element);if(!r)continue;
   // A dialog is in the browser top layer. Avoid sampling the dimmed page while
   // it is open; its previous text stays stable until the dialog closes.
   if(open&&!open.contains(element))continue;
   const scene=element.closest('#restoring')||(html.classList.contains('is-standalone')?html:element.closest('.app-frame'));
   if(!scene)continue;
   const sceneStyle=style(scene),box=scene.getBoundingClientRect();
   const base=parseColor(sceneStyle.backgroundColor),overlay=gradientColours(sceneStyle.backgroundImage)[0]||[0,0,0,0];
   const image=entry?.image,data=entry?.data;
   const ratio=image?.naturalWidth?image.naturalHeight/image.naturalWidth:2;
   const height=Math.min(box.height,innerWidth*ratio),width=height/ratio,left=box.left+(box.width-width)/2,top=box.bottom-height;
   const layers=[];for(let parent=element;parent&&parent!==scene;parent=parent.parentElement)layers.unshift(parent);
   const backdrop=open&&open.contains(element)?parseColor(getComputedStyle(open,'::backdrop').backgroundColor):null;
   const samples=samplePoints(r).map(([x,y])=>{
    let colour=base.slice(0,3);
    if(data&&y>=top&&y<box.bottom){const sx=x<left||x>=left+width?0:Math.max(0,Math.min(data.width-1,Math.floor((x-left)/width*data.width)));const sy=Math.max(0,Math.min(data.height-1,Math.floor((y-top)/height*data.height)));const i=(sy*data.width+sx)*4;colour=[data.data[i],data.data[i+1],data.data[i+2]];}
    colour=compositeColor(overlay,colour);
    if(backdrop){
     const behind=underlying.find(({rect:b})=>x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom);
     if(behind){const behindLayers=[];for(let parent=behind.element;parent&&parent!==scene;parent=parent.parentElement)behindLayers.unshift(parent);colour=paintLayers(colour,behindLayers,x);}
     colour=compositeColor(backdrop,colour);
    }
    colour=paintLayers(colour,layers,x);
    return colour;
   });
   const tone=chooseTextTone(samples,element.dataset.adaptiveText||(!data?(dark()?'light':'dark'):undefined));
   if(element.dataset.adaptiveText!==tone)element.dataset.adaptiveText=tone;tracked.add(element);
  }
 }
 function schedule(){if(disposed)return;clearTimeout(timer);timer=setTimeout(()=>{if(!frame)frame=requestAnimationFrame(update);},80);}
 function changes(){schedule();clearTimeout(settled);settled=setTimeout(schedule,550);}
 const observer=new MutationObserver(changes);observer.observe(html,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','open','data-theme','data-theme-background','data-theme-surface','data-theme-mode']});
 document.addEventListener('scroll',schedule,true);window.addEventListener('resize',changes);window.visualViewport?.addEventListener('resize',changes);
 const media=matchMedia('(prefers-color-scheme: dark)');media.addEventListener('change',changes);schedule();
 return ()=>{disposed=true;observer.disconnect();clearTimeout(timer);clearTimeout(settled);cancelAnimationFrame(frame);document.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',changes);window.visualViewport?.removeEventListener('resize',changes);media.removeEventListener('change',changes);clean();bitmaps.clear();};
}
