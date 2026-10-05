// A focused field plus a substantial visible-height loss separates keyboards from toolbar motion.
export function keyboardGeometry({baseHeight,height,offsetTop=0,keyboardHeight=0,focused=false,width,baseWidth,scale=1}) {
 const sameWidth=Math.abs(width-baseWidth)<40;
 const available=Math.min(height,baseHeight-Math.max(0,keyboardHeight));
 const open=focused && sameWidth && Math.abs(scale-1)<.05 && baseHeight-available>Math.max(120,baseHeight*.18);
 return {open,height:Math.max(120,available),top:Math.max(0,offsetTop)};
}
export function initKeyboardViewport() {
 const root=document.documentElement, viewport=window.visualViewport;
 let baseHeight=window.innerHeight, baseWidth=window.innerWidth, frame=0, touchY=0, keyboardWasOpen=false;
 const editable=()=>document.activeElement?.matches('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),textarea,[contenteditable="true"]');
 try { if(navigator.virtualKeyboard) navigator.virtualKeyboard.overlaysContent=true; } catch { /* Safari uses VisualViewport instead. */ }
 function update() {
  frame=0;
  const mobile=window.innerWidth<=700 || matchMedia('(pointer: coarse)').matches, focused=!!editable();
  if((!focused && !keyboardWasOpen) || Math.abs(window.innerWidth-baseWidth)>=40) {baseHeight=window.innerHeight;baseWidth=window.innerWidth;}
  const geometry=keyboardGeometry({baseHeight,height:viewport?.height || window.innerHeight,offsetTop:viewport?.offsetTop || 0,keyboardHeight:navigator.virtualKeyboard?.boundingRect?.height || 0,focused:focused || keyboardWasOpen,width:window.innerWidth,baseWidth,scale:viewport?.scale || 1});
  const open=mobile && geometry.open;
  keyboardWasOpen=open;
  root.style.setProperty('--app-height',`${baseHeight}px`);
  root.style.setProperty('--visible-height',`${open ? geometry.height : Math.min(baseHeight,viewport?.height || baseHeight)}px`);
  root.style.setProperty('--visible-top',`${open ? geometry.top : 0}px`);
  root.classList.toggle('keyboard-open',open);
  // Root never owns scrolling. WebKit focus panning can still occur; correct its document offset.
  if(mobile && window.scrollY!==0) window.scrollTo(0,0);
  if(open) {
   const field=document.activeElement, container=field?.closest('.habit-dialog[open],#auth-shell .panel,#admin-page .admin-login-card,.admin-active .app-content');
   if(container) {
    const fieldRect=field.getBoundingClientRect(), box=container.getBoundingClientRect();
    const bottom=Math.min(box.bottom,geometry.top+geometry.height)-16;
    if(fieldRect.bottom>bottom) container.scrollTop+=fieldRect.bottom-bottom;
    else if(fieldRect.top<box.top+16) container.scrollTop-=box.top+16-fieldRect.top;
   }
  }
 }
 const schedule=()=>{if(!frame) frame=requestAnimationFrame(update);};
 for(const type of ['resize','scroll']) viewport?.addEventListener(type,schedule,{passive:true});
 window.addEventListener('resize',schedule,{passive:true});window.addEventListener('scroll',schedule,{passive:true});
 navigator.virtualKeyboard?.addEventListener('geometrychange',schedule);
 document.addEventListener('focusin',schedule);document.addEventListener('focusout',schedule);
 // Prevent scroll chaining and rubber-band gestures outside the editable surface.
 document.addEventListener('touchstart',event=>{touchY=event.touches[0]?.clientY || 0;},{passive:true});
 document.addEventListener('touchmove',event=>{
  if(!root.classList.contains('keyboard-open') || event.touches.length!==1) return;
  const y=event.touches[0].clientY, delta=y-touchY;touchY=y;
  if(event.target.closest('input,textarea,[contenteditable="true"]')) return;
  const container=event.target.closest('.habit-dialog[open],#auth-shell .panel,#admin-page .admin-login-card,.admin-active .app-content');
  const canScroll=container && (delta>0 ? container.scrollTop>1 : container.scrollTop+container.clientHeight<container.scrollHeight-1);
  if(!canScroll && event.cancelable) event.preventDefault();
 },{passive:false});
 update();
}
