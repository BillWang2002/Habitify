import {Marked} from 'marked';
import createDOMPurify from 'dompurify';
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parser=new Marked({gfm:true,breaks:true,renderer:{html:token=>escape(token.text)}});
export function markdownFragment(source,doc=document){
 const purifier=createDOMPurify(doc.defaultView);
 const fragment=purifier.sanitize(parser.parse(source),{RETURN_DOM_FRAGMENT:true,ALLOWED_TAGS:['p','br','h1','h2','h3','h4','h5','h6','strong','em','del','blockquote','ul','ol','li','pre','code','hr','a','table','thead','tbody','tr','th','td'],ALLOWED_ATTR:['href','title'],ALLOW_DATA_ATTR:false});
 for(const a of fragment.querySelectorAll('a')){
  const href=a.getAttribute('href')||'';
  if(!/^https?:\/\//i.test(href)){a.removeAttribute('href');continue;}
  try{const url=new URL(href);if(url.username||url.password)throw new Error();a.setAttribute('href',url.href);a.setAttribute('target','_blank');a.setAttribute('rel','noopener noreferrer');}catch{a.removeAttribute('href');}
 }
 return fragment;
}
export function renderMarkdown(root,source){root.replaceChildren(markdownFragment(source,root.ownerDocument));}
export function bindMarkdownEditor(textarea,preview,toolbar,onChange=()=>{}){
 const update=()=>{renderMarkdown(preview,textarea.value);onChange();};
 textarea.addEventListener('input',update);
 const tools=[['标题','## ',''],['粗体','**','**'],['列表','- ',''],['引用','> ',''],['链接','[','](https://example.com)']];
 for(const [label,before,after] of tools){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{const start=textarea.selectionStart,end=textarea.selectionEnd,text=textarea.value.slice(start,end)||'文字';textarea.setRangeText(before+text+after,start,end,'select');textarea.focus();update();};toolbar.append(b);}
 return update;
}
