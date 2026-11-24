import { put,del } from '@vercel/blob';
export function cloudBucket(DB,{token=process.env.BLOB_READ_WRITE_TOKEN,uploader=put,remover=del,fetcher=fetch}={}){
 function check(key){if(!/^products\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(key))throw new Error('Tên ảnh không hợp lệ.');}
 return {
  async put(key,data,metadata){
   check(key);if(!token)throw new Error('Chưa kết nối Vercel Blob.');
   const blob=await uploader(key,data,{access:'public',addRandomSuffix:true,contentType:metadata.httpMetadata.contentType,token});
   try{await DB.prepare('INSERT INTO upload_objects(key,url,content_type,created_at) VALUES(?,?,?,?)').bind(key,blob.url,metadata.httpMetadata.contentType,Date.now()).run();}
   catch(error){await remover(blob.url,{token}).catch(()=>{});throw error;}
  },
  async get(key){
   check(key);const row=await DB.prepare('SELECT url,content_type FROM upload_objects WHERE key=?').bind(key).first();if(!row)return null;
   const u=new URL(row.url);if(u.protocol!=='https:'||!u.hostname.endsWith('.public.blob.vercel-storage.com'))throw new Error('Địa chỉ kho ảnh không hợp lệ.');
   const response=await fetcher(u,{redirect:'error'});if(response.status===404)return null;if(!response.ok)throw new Error('Không đọc được ảnh.');
   return {body:response.body,httpMetadata:{contentType:row.content_type}};
  }
 };
}
