import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ROOT } from './lib/database.mjs';
import { cloudBucket } from './lib/bucket.mjs';
import { currentUser,handleAuth } from './lib/auth.mjs';
import { storefront,administration,authPage,productPage,sitemap,setupPage,esc } from './lib/pages.mjs';
import { handleShop,isOwner } from './core/shop.mjs';
const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
function safeReturn(value){try{if(!value||!value.startsWith('/')||value.startsWith('//'))return '/';const u=new URL(value,'https://local.invalid');if(u.origin!=='https://local.invalid'||u.pathname.startsWith('/api/')||['/dang-nhap','/dang-ky','/dang-xuat','/setup'].includes(u.pathname))return '/';return u.pathname+u.search+u.hash;}catch{return '/';}}
export function createShop({storage,origin='http://localhost:3000',bucket,setupToken,preview=false}){
 const configured=new URL(origin);if(!['http:','https:'].includes(configured.protocol)||configured.username||configured.password||configured.pathname!=='/')throw new Error('PUBLIC_ORIGIN phải là địa chỉ gốc của website.');origin=configured.origin;
 const env={DB:storage.DB,BUCKET:bucket||cloudBucket(storage.DB),ACCOUNT_CIPHER_KEY:storage.secrets.accountCipherKey};
 async function fetch(request,ip='local'){
  const nonce=randomBytes(18).toString('base64'),url=new URL(request.url);let response;
  try{
   if(url.origin!==origin){response=['GET','HEAD'].includes(request.method)?new Response(null,{status:308,headers:{Location:origin+url.pathname+url.search}}):new Response('Địa chỉ không hợp lệ.',{status:403});}
   else{
   const user=await currentUser(request,storage),pathname=url.pathname;
   if(pathname.startsWith('/api/auth/'))response=await handleAuth(request,storage,{origin,ip,setupToken});
   else if(pathname.startsWith('/api/'))response=await handleShop(request,env,user);
   else if(pathname==='/healthz')response=Response.json({ok:true});
   else if(!['GET','HEAD'].includes(request.method))response=new Response('Phương thức không hợp lệ.',{status:405});
   else if(pathname==='/robots.txt')response=new Response(preview?'User-agent: *\nDisallow: /\n':`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /setup\nDisallow: /dang-nhap\nDisallow: /dang-ky\nDisallow: /dang-xuat\nSitemap: ${origin}/sitemap.xml\n`,{headers:{'Content-Type':'text/plain; charset=utf-8'}});
   else if(pathname==='/sitemap.xml')response=new Response(await sitemap(storage,origin),{headers:{'Content-Type':'application/xml; charset=utf-8'}});
   else if(pathname==='/'||pathname==='/index.html'){
    const catalog=await handleShop(new Request(origin+'/api/catalog'),env,null);if(!catalog.ok)throw new Error('Không đọc được danh mục.');
    response=new Response(await storefront(storage,origin),{headers:{'Content-Type':'text/html; charset=utf-8'}});
   }
   else if(pathname==='/setup'){
    const owner=await storage.DB.prepare("SELECT value FROM configuration WHERE key='owner_user_id'").first();
    response=owner?new Response(null,{status:303,headers:{Location:'/dang-nhap?return=%2Fadmin'}}):new Response(await setupPage(storage),{headers:{'Content-Type':'text/html; charset=utf-8'}});
   }
   else if(pathname==='/admin'){
    if(!user)response=new Response(null,{status:303,headers:{Location:'/dang-nhap?return=%2Fadmin'}});
    else if(!await isOwner(user,env))response=new Response('Chỉ chủ shop được truy cập trang quản trị.',{status:403});
    else response=new Response(await administration(storage),{headers:{'Content-Type':'text/html; charset=utf-8'}});
   }
   else if(['/dang-nhap','/dang-ky','/dang-xuat'].includes(pathname)){const action=pathname==='/dang-ky'?'register':pathname==='/dang-xuat'?'logout':'login';response=new Response(await authPage(storage,action,safeReturn(url.searchParams.get('return'))),{headers:{'Content-Type':'text/html; charset=utf-8'}});}
   else if(/^\/acc\/[A-Za-z0-9-]+$/.test(pathname)){
    const catalog=await handleShop(new Request(origin+'/api/catalog'),env,null);if(!catalog.ok)throw new Error('Không đọc được danh mục.');
    const html=await productPage(storage,origin,pathname.slice(5),nonce);response=html?new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8'}}):new Response('Tài khoản không tồn tại hoặc không mở bán.',{status:404});
   }
   else if(/^\/(shop\.js|admin\.js|auth\.js|style\.css|admin\.css)$/.test(pathname)||/^\/assets\/[A-Za-z0-9_.-]+$/.test(pathname)){
    try{const buffer=await readFile(path.join(ROOT,'public',pathname));response=new Response(buffer,{headers:{'Content-Type':types[path.extname(pathname)]||'application/octet-stream','Cache-Control':'public,max-age=300'}});}catch(e){if(e.code!=='ENOENT')throw e;response=new Response('Không tìm thấy.',{status:404});}
   }else response=new Response('Không tìm thấy trang. Về trang chủ: '+esc(origin),{status:404});
   }
  }catch(error){console.error('Application error:',error.code||error.name||'unknown');response=new Response('Không thể xử lý yêu cầu. Vui lòng thử lại sau.',{status:500});}
  response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');response.headers.set('X-Frame-Options','SAMEORIGIN');response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');response.headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`);
  if(preview||/^\/(admin|api|setup|dang-nhap|dang-ky|dang-xuat|healthz)(\/|$)/.test(url.pathname)||response.status>=400)response.headers.set('X-Robots-Tag','noindex, nofollow');
  if((response.headers.get('Content-Type')||'').includes('text/html'))response.headers.set('Cache-Control','no-store');
  return response;
 }
 return {fetch,storage,close:()=>storage.close(),origin};
}
