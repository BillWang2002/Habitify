// Public image colours only; no user data, screenshots or network inference.
export function parseColor(value){
 const values=value?.match(/rgba?\(([^)]+)\)/)?.[1].split(/[,\s/]+/).filter(Boolean).map(Number);
 return values?.length>=3&&values.every(Number.isFinite)?[...values.slice(0,3),values[3]??1]:[0,0,0,0];
}
export const compositeColor=(front,back)=>front.slice(0,3).map((v,i)=>v*(front[3]??1)+back[i]*(1-(front[3]??1)));
export function luminance(rgb){return rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
export function contrast(a,b){const values=[luminance(a),luminance(b)].sort((a,b)=>a-b);return (values[1]+.05)/(values[0]+.05);}
export const textPalettes=Object.freeze({dark:{ink:[33,24,15],muted:[58,45,28]},light:{ink:[255,253,245],muted:[255,243,220]}});
export function chooseTextTone(samples,previous){
 if(!samples.length)return previous||'dark';
 const scores=Object.fromEntries(Object.entries(textPalettes).map(([tone,palette])=>[tone,Math.min(...samples.flatMap(bg=>[contrast(palette.ink,bg),contrast(palette.muted,bg)]))]));
 const next=scores.dark>=scores.light?'dark':'light';
 // Hold the existing tone near the crossing point instead of flashing on scroll.
 return previous&&scores[next]-scores[previous]<.55?previous:next;
}
