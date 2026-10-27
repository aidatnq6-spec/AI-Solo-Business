import { mkdir, readFile, writeFile, rename, stat, rm } from "node:fs/promises";
import path from "node:path";
import { newDatabase } from "../domain/workflow";
import { AppError, type Database } from "../domain/schemas";
import { appMode } from "../auth/require-owner";
import { firestore } from "../firebase/admin";
const clean=<T>(v:T):T=>JSON.parse(JSON.stringify(v));
const dataDir=()=>path.join(process.cwd(),".data");
const safe=(id:string)=>{if(!/^[\w-]{1,128}$/.test(id))throw new AppError(400,"Mã tài nguyên không hợp lệ.");return id;};
export async function withDatabase<T>(uid:string,fn:(db:Database)=>T):Promise<T>{
 safe(uid);
 if(appMode()==="demo"){
  if(process.env.NODE_ENV==="production")throw new AppError(503,"Không cho phép kho demo trong production.");
  await mkdir(dataDir(),{recursive:true});const file=path.join(dataDir(),`${uid}.json`);const lock=file+".lock";let acquired=false;
  for(let i=0;i<100;i++){try{await mkdir(lock);acquired=true;break;}catch(e){if((e as NodeJS.ErrnoException).code!=="EEXIST")throw e;try{if(Date.now()-(await stat(lock)).mtimeMs>30000)await rm(lock,{recursive:true});}catch{}await new Promise(r=>setTimeout(r,30));}}
  if(!acquired)throw new AppError(503,"Kho dữ liệu đang bận. Hãy thử lại.");
  try{let db:Database;try{db=JSON.parse(await readFile(file,"utf8"));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;db=newDatabase();}const before=JSON.stringify(db);const result=fn(db);if(JSON.stringify(db)!==before||!(await stat(file).catch(()=>null))){const temp=file+".tmp";await writeFile(temp,JSON.stringify(db),"utf8");await rename(temp,file);}return clean(result);}finally{await rm(lock,{recursive:true,force:true});}
 }
 const db=firestore();const base=db.collection("users").doc(uid);const names=["products","sources","campaigns","jobs","assets","usage"] as const;
 return db.runTransaction(async tx=>{
  const snapshots=await Promise.all(names.map(n=>tx.get(base.collection(n))));const settings=await tx.get(base.collection("profile").doc("main"));
  const state=newDatabase();for(let i=0;i<names.length;i++)(state[names[i]] as unknown[])=snapshots[i].docs.map(d=>d.data());
  if(!snapshots[0].size)state.products=newDatabase().products;if(settings.exists)state.settings=settings.data() as Database["settings"];
  for(const c of state.campaigns){const docs=await tx.get(base.collection("campaigns").doc(c.id).collection("contents"));c.contents=docs.docs.map(d=>d.data()) as typeof c.contents;}
  const before=clean(state);const result=fn(state);
  for(let i=0;i<names.length;i++){const n=names[i];for(const record of state[n]){const old=(before[n] as {id:string}[]).find(x=>x.id===record.id);const ref=base.collection(n).doc(record.id);if(n==="campaigns"){
     const c=record as Database["campaigns"][number];const prev=old as typeof c|undefined;const {contents,...header}=c;const {contents:_,...oldHeader}=prev??{contents:[]};if(!snapshots[i].docs.some(d=>d.id===c.id)||JSON.stringify(header)!==JSON.stringify(oldHeader))tx.set(ref,clean(header));for(const item of contents){const previous=prev?.contents.find(x=>x.id===item.id);if(JSON.stringify(item)!==JSON.stringify(previous))tx.set(ref.collection("contents").doc(item.id),clean(item));}
    }else if(!snapshots[i].docs.some(d=>d.id===record.id)||JSON.stringify(record)!==JSON.stringify(old))tx.set(ref,clean(record));}}
  if(!settings.exists||JSON.stringify(state.settings)!==JSON.stringify(before.settings))tx.set(base.collection("profile").doc("main"),clean(state.settings));return clean(result);
 });
}
export async function saveBlob(uid:string,p:string,bytes:Buffer,mime:string){if(appMode()==="demo"){const target=path.join(dataDir(),safe(uid),p);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);}else{const {bucket}=await import("../firebase/admin");await bucket().file(`users/${safe(uid)}/${p}`).save(bytes,{contentType:mime,resumable:false});}}
export async function readBlob(uid:string,p:string){if(p.includes("..")||path.isAbsolute(p))throw new AppError(400,"Đường dẫn không hợp lệ.");if(appMode()==="demo")return readFile(path.join(dataDir(),safe(uid),p));const {bucket}=await import("../firebase/admin");return (await bucket().file(`users/${safe(uid)}/${p}`).download())[0];}
