import {build} from 'esbuild';
await build({entryPoints:['supabase/functions/feedback-mail/index.ts'],bundle:true,format:'esm',platform:'neutral',target:'es2022',external:['npm:*'],outfile:'/tmp/habitify-feedback-mail-function.ts'});
console.log('已生成反馈邮件任务部署文件（无配置凭据）。');
