import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const ROOT=fileURLToPath(new URL('../',import.meta.url));
const numericFields=new Set(['price','bp','fc','total','created_at','updated_at','expires_at','completed_at','n']);
function rows(result){return (result.rows||[]).map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,numericFields.has(key)&&value!==null?Number(value):value])));}
export function parameters(sql){let n=0;return sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g,part=>part==='?'?'$'+(++n):part);}
export function databaseAdapter(pool){
 class Statement {
  constructor(sql,values=[]){this.sql=parameters(sql);this.values=values;}
  bind(...values){return new Statement(this.sql,values);}
  async run(){const r=await pool.query(this.sql,this.values);return {success:true,meta:{changes:r.rowCount??r.affectedRows??0}};}
  async first(){return rows(await pool.query(this.sql,this.values))[0]||null;}
  async all(){return {success:true,results:rows(await pool.query(this.sql,this.values))};}
 }
 async function transaction(fn){
  for(let attempt=0;;attempt++){
   const client=await pool.connect();
   try{await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');const result=await fn(client);await client.query('COMMIT');return result;}
   catch(error){await client.query('ROLLBACK').catch(()=>{});if(!['40001','40P01'].includes(error.code)||attempt>=3)throw error;}
   finally{client.release();}
  }
 }
 return {prepare:sql=>new Statement(sql),transaction,batch:statements=>transaction(async client=>{
  const results=[];for(const statement of statements){const r=await client.query(statement.sql,statement.values);results.push({success:true,meta:{changes:r.rowCount??r.affectedRows??0}});}return results;
 })};
}
export async function migrate(pool){
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(184635901)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_versions(version INTEGER PRIMARY KEY)');
  const version=await client.query('SELECT MAX(version) AS n FROM schema_versions');
  if(Number(version.rows[0]?.n||0)>1)throw new Error('Phiên bản cơ sở dữ liệu mới hơn mã nguồn.');
  if(!version.rows[0]?.n){await client.query(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));await client.query('INSERT INTO schema_versions(version) VALUES(1)');}
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}
let storagePromise;
export async function openStorage(){
 if(!storagePromise){storagePromise=(async()=>{
  if(!process.env.DATABASE_URL)throw new Error('Thiếu DATABASE_URL.');
  const key=process.env.ACCOUNT_CIPHER_KEY||'';
  if(!/^[A-Za-z0-9+/]{43}=$/.test(key)||Buffer.from(key,'base64').length!==32)throw new Error('ACCOUNT_CIPHER_KEY cần là 32 byte ở dạng Base64.');
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,allowExitOnIdle:true});
  pool.on('error',()=>console.error('PostgreSQL connection error'));
  try{await migrate(pool);}catch(error){await pool.end();throw error;}
  return {pool,DB:databaseAdapter(pool),secrets:{accountCipherKey:key},close:()=>pool.end()};
 })().catch(error=>{storagePromise=undefined;throw error;});}
 return storagePromise;
}
