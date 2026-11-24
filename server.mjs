import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createShop } from './app.mjs';
import { openStorage } from './lib/database.mjs';
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
const origin=process.env.PUBLIC_ORIGIN||'http://localhost:'+port;
if(process.env.NODE_ENV==='production'&&!origin.startsWith('https://'))throw new Error('Cần đặt PUBLIC_ORIGIN=https://ten-mien-cua-ban khi chạy production.');
const shop=createShop({origin,storage:await openStorage()});
function bodyOf(req){return new Promise((resolve,reject)=>{const chunks=[];let length=0,failed=false;req.on('data',chunk=>{length+=chunk.length;if(length>4*1024*1024){if(!failed){failed=true;reject(Object.assign(new Error('Nội dung quá lớn.'),{status:413}));}return;}if(!failed)chunks.push(chunk);});req.on('end',()=>{if(!failed)resolve(Buffer.concat(chunks));});req.on('error',reject);});}
const server=createServer(async(req,res)=>{try{
 if(!req.url?.startsWith('/')||req.url.startsWith('//')){res.writeHead(400);res.end('Địa chỉ không hợp lệ.');return;}
 const headers=new Headers();for(const [key,value]of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
 const body=['GET','HEAD'].includes(req.method)?undefined:await bodyOf(req);
 const request=new Request(new URL(req.url,origin),{method:req.method,headers,...(body===undefined?{}:{body})});
 const ip=process.env.TRUST_PROXY==='1'?(String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim()):req.socket.remoteAddress;
 const response=await shop.fetch(request,ip);res.writeHead(response.status,Object.fromEntries(response.headers));if(req.method==='HEAD'||!response.body){res.end();return;}Readable.fromWeb(response.body).on('error',()=>res.destroy()).pipe(res);
 }catch(error){if(!res.headersSent)res.writeHead(error.status||500,{'Content-Type':'text/plain; charset=utf-8'});res.end('Không thể xử lý yêu cầu.');}});
server.requestTimeout=30000;server.headersTimeout=15000;
server.listen(port,host,()=>console.log('KhoFCO đang chạy tại '+origin+' (cổng '+server.address().port+')'));
function shutdown(){server.close(()=>{Promise.resolve(shop.close()).finally(()=>process.exit(0));});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
