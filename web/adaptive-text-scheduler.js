// Bounded updates during continuous scrolling, rather than waiting for it to stop.
export function createTextScheduler(run,{setTimer=setTimeout,clearTimer=clearTimeout,requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame}={}){
 let timer=null,frame=null,stopped=false;
 return {
  request(){if(stopped||timer!==null||frame!==null)return;timer=setTimer(()=>{timer=null;frame=requestFrame(()=>{frame=null;if(!stopped)run();});},80);},
  dispose(){stopped=true;if(timer!==null)clearTimer(timer);if(frame!==null)cancelFrame(frame);timer=frame=null;}
 };
}
