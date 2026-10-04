export function checkinErrors(mode, values, maxProgress=0) {
 const errors={};
 if(mode==='create') {
  if(!values.name.trim()) errors['habit-name']='给这项打卡起个名字吧。';
  else if(values.name.trim().length>30) errors['habit-name']='名称最多 30 个字。';
  if(values.kind==='quantity') {
   if(!values.goal.trim() || !Number.isSafeInteger(Number(values.goal)) || Number(values.goal)<1 || Number(values.goal)>100000) errors['habit-goal']='请输入 1 到 100000 之间的整数目标。';
   if(!values.unit.trim()) errors['habit-unit']='请填写单位，例如杯、分钟或页。';
   else if(values.unit.trim().length>6) errors['habit-unit']='单位最多 6 个字。';
  }
  if(values.note.trim().length>200) errors['habit-note']='备注最多 200 个字。';
 } else if(mode==='progress') {
  if(!values.progress.trim() || !Number.isSafeInteger(Number(values.progress)) || Number(values.progress)<0 || Number(values.progress)>maxProgress) errors['habit-progress']=`请输入 0 到 ${maxProgress} 之间的整数进度。`;
 }
 return errors;
}
export function showFieldErrors(root,errors,ids,{focus=true}={}) {
 for(const id of ids) { const input=root.querySelector(`#${id}`),note=root.querySelector(`#${id}-error`);input.setAttribute('aria-invalid',String(!!errors[id]));note.textContent=errors[id] || '';note.hidden=!errors[id]; }
 if(focus && Object.keys(errors).length) root.querySelector(`#${Object.keys(errors)[0]}`).focus();
 return !Object.keys(errors).length;
}
