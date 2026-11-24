import { scrypt as scryptCallback,randomBytes,randomUUID,createHash,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback),ttl=7*24*3600*1000;
const hashToken=v=>createHash('sha256').update(v).digest('hex');
export const normalizeEmail=value=>typeof value==='string'?value.trim().toLowerCase().slice(0,254):'';
export const validEmail=email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export const validPassword=value=>typeof value==='string'&&value.length>=12&&value.length<=128;
let running=0;const waiting=[];
async function derive(password,salt){await new Promise(resolve=>{if(running<2){running++;resolve();}else waiting.push(resolve);});try{return await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});}finally{const next=waiting.shift();if(next)next();else running--;}}
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');return 'scrypt$'+salt+'$'+(await derive(password,salt)).toString('hex');}
async function checkPassword(password,encoded){const [,salt,hex]=String(encoded||'').split('$');if(!salt||!hex)return false;try{const expected=Buffer.from(hex,'hex'),actual=await derive(password,salt);return expected.length===actual.length&&timingSafeEqual(expected,actual);}catch{return false;}}
function sameSecret(a,b){const x=hashToken(String(a||'')),y=hashToken(String(b||''));return timingSafeEqual(Buffer.from(x),Buffer.from(y));}
export async function createOwner(storage,{email,name,password}){
 email=normalizeEmail(email);name=String(name||'Chủ shop').trim().slice(0,60);
 if(!validEmail(email)||!validPassword(password)||name.length<2)throw new Error('Nhập email hợp lệ, tên từ 2 ký tự và mật khẩu từ 12 đến 128 ký tự.');
 const id=randomUUID(),hash=await passwordHash(password);
 await storage.DB.transaction(async client=>{
  // A unique configuration key and this transaction prevent two initial owners.
  await client.query('INSERT INTO users(id,email,name,password_hash,created_at) VALUES($1,$2,$3,$4,$5)',[id,email,name,hash,Date.now()]);
  await client.query("INSERT INTO configuration(key,value) VALUES('owner_user_id',$1)",[id]);
 });return id;
}
const sessionToken=request=>(request.headers.get('cookie')||'').match(/(?:^|;\s*)kf_session=([a-f0-9]{64})(?:;|$)/)?.[1];
export async function currentUser(request,storage){const token=sessionToken(request);if(!token)return null;const row=await storage.DB.prepare('SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(hashToken(token),Date.now()).first();return row?{userId:row.id,email:row.email,displayName:row.name}:null;}
export async function sessionCookie(storage,userId,secure){const token=randomBytes(32).toString('hex');await storage.DB.prepare('DELETE FROM sessions WHERE expires_at<=?').bind(Date.now()).run();await storage.DB.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').bind(hashToken(token),userId,Date.now()+ttl).run();return `kf_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ttl/1000}${secure?'; Secure':''}`;}
async function rateLimit(storage,key,limit){const now=Date.now();const row=await storage.DB.prepare('INSERT INTO auth_attempts(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=CASE WHEN auth_attempts.expires_at<=? THEN 1 ELSE auth_attempts.attempts+1 END,expires_at=CASE WHEN auth_attempts.expires_at<=? THEN excluded.expires_at ELSE auth_attempts.expires_at END WHERE auth_attempts.expires_at<=? OR auth_attempts.attempts<? RETURNING attempts').bind(hashToken(key),now+15*60000,now,now,now,limit).first();return !!row;}
const json=(value,status=200,cookie)=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function handleAuth(request,storage,{origin,ip='local',setupToken=process.env.SETUP_TOKEN||''}){
 const action=new URL(request.url).pathname.split('/').at(-1);
 if(request.method!=='POST')return json({error:'Phương thức không hợp lệ.'},405);
 if(request.headers.get('origin')!==origin)return json({error:'Yêu cầu không cùng nguồn.'},403);
 const secure=origin.startsWith('https:');
 if(action==='logout'){const token=sessionToken(request);if(token)await storage.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(hashToken(token)).run();return json({ok:true},200,`kf_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure?'; Secure':''}`);}
 if(!['login','register','setup'].includes(action))return json({error:'Không tìm thấy chức năng.'},404);
 if(!await rateLimit(storage,'ip:'+ip,60))return json({error:'Bạn đã thử nhiều lần. Vui lòng chờ 15 phút.'},429);
 let p;try{const text=await request.text();if(text.length>12000)return json({error:'Nội dung quá lớn.'},413);p=JSON.parse(text);if(!p||typeof p!=='object')throw new Error();}catch{return json({error:'Nội dung không hợp lệ.'},400);}
 const existingOwner=await storage.DB.prepare("SELECT value FROM configuration WHERE key='owner_user_id'").first();
 if(action==='setup'){
  if(existingOwner)return json({error:'Shop đã có chủ sở hữu. Vui lòng đăng nhập.'},409);
  if(setupToken.length<32)return json({error:'Chủ shop cần cấu hình SETUP_TOKEN trên Vercel.'},503);
  if(!await rateLimit(storage,'setup:'+ip,10))return json({error:'Thử lại sau 15 phút.'},429);
  if(!sameSecret(p.token,setupToken))return json({error:'Mã thiết lập chưa đúng.'},403);
  if(!validEmail(normalizeEmail(p.email))||!validPassword(p.password)||typeof p.name!=='string'||p.name.trim().length<2)return json({error:'Tên từ 2 ký tự, email hợp lệ, mật khẩu từ 12 đến 128 ký tự.'},400);
  let id;try{id=await createOwner(storage,p);}catch(error){if(error.code==='23505')return json({error:'Shop đã được thiết lập hoặc email đã tồn tại.'},409);throw error;}
  return json({ok:true},201,await sessionCookie(storage,id,secure));
 }
 if(!existingOwner)return json({error:'Chủ shop cần mở /setup để thiết lập lần đầu.'},503);
 const email=normalizeEmail(p.email),password=p.password;
 if(!validEmail(email)||typeof password!=='string'||password.length>128)return json({error:'Kiểm tra email và mật khẩu.'},400);
 if(!await rateLimit(storage,action+':'+email,10))return json({error:'Bạn đã thử nhiều lần. Vui lòng chờ 15 phút.'},429);
 if(action==='register'){
  const name=typeof p.name==='string'?p.name.trim().slice(0,60):'';if(name.length<2||!validPassword(password))return json({error:'Tên từ 2 ký tự; mật khẩu từ 12 đến 128 ký tự.'},400);
  const id=randomUUID(),hash=await passwordHash(password);
  try{await storage.DB.prepare('INSERT INTO users(id,email,name,password_hash,created_at) VALUES(?,?,?,?,?)').bind(id,email,name,hash,Date.now()).run();}
  catch(error){if(error.code!=='23505')throw error;return json({error:'Không thể tạo tài khoản với email này.'},409);}
  return json({ok:true},201,await sessionCookie(storage,id,secure));
 }
 const user=await storage.DB.prepare('SELECT id,password_hash FROM users WHERE email=?').bind(email).first();
 const dummy='scrypt$00000000000000000000000000000000$'+'00'.repeat(64);
 if(!await checkPassword(password,user?.password_hash||dummy)||!user)return json({error:'Email hoặc mật khẩu chưa đúng.'},401);
 await storage.DB.prepare('DELETE FROM auth_attempts WHERE bucket=?').bind(hashToken('login:'+email)).run();
 return json({ok:true},200,await sessionCookie(storage,user.id,secure));
}
