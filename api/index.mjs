import { openStorage } from '../lib/database.mjs';
import { createShop } from '../app.mjs';
export default {
 async fetch(request){
  try{
   const preview=process.env.VERCEL_ENV==='preview';
   const origin=preview&&process.env.VERCEL_URL?'https://'+process.env.VERCEL_URL:process.env.PUBLIC_ORIGIN||('https://'+(process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL||'localhost:3000'));
   const storage=await openStorage();
   const shop=createShop({storage,origin,preview});
   const ip=request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim()||'unknown';
   return await shop.fetch(request,ip);
  }catch(error){
   console.error('Shop initialization failed:',error.code||error.name||'configuration');
   return new Response('<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shop đang thiết lập</title><link rel="stylesheet" href="/style.css"><main class="auth-wrap"><section class="auth-card"><h1>Shop đang thiết lập</h1><p>Chủ shop cần hoàn tất kết nối dữ liệu trong Vercel rồi triển khai lại. Xem file README.md đi kèm mã nguồn.</p></section></main></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex,nofollow','X-Content-Type-Options':'nosniff'}});
  }
 }
};
