import {build} from 'esbuild';
// Standalone Dashboard deployment artifact. No credentials or administrator identity embedded.
await build({entryPoints:['supabase/functions/admin/index.ts'],bundle:true,format:'esm',platform:'neutral',target:'es2022',external:['npm:*'],outfile:'/tmp/habitify-admin-function.ts'});
console.log('已生成独立后台登录API部署文件。');
