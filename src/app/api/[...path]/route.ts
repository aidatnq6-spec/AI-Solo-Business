import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { authorize, appMode } from "@/lib/auth/require-owner";
import { withDatabase, saveBlob, readBlob } from "@/lib/repositories/store";
import { AppError, now, productSchema, sourceSchema, settingsSchema, type Campaign } from "@/lib/domain/schemas";
import { createCampaign, queueJob, editCampaignContent } from "@/lib/domain/workflow";
import { approveContent } from "@/lib/domain/review";
import { validateLogo } from "@/lib/media/poster";
import { publishJob } from "@/lib/jobs/publish-outbox";

export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{path:string[]}>};
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
async function body(req:Request){if(!req.headers.get("content-type")?.includes("application/json"))throw new AppError(415,"Yêu cầu cần dùng JSON.");const raw=await req.text();if(raw.length>150000)throw new AppError(413,"Nội dung yêu cầu quá lớn.");try{return JSON.parse(raw);}catch{throw new AppError(400,"Dữ liệu JSON không hợp lệ.");}}
async function handle(req:NextRequest,context:Context){try{
 const segments=(await context.params).path;const [entity,id,resource,rid,action]=segments;const method=req.method;
 if(entity==="config"&&method==="GET")return reply({mode:appMode(),aiMode:process.env.AI_MODE??"demo",firebase:{apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY??"demo-key",projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID??"demo-content-studio",authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN??"demo-content-studio.firebaseapp.com",storageBucket:process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET??"demo-content-studio.appspot.com"},textConfigured:!!process.env.EVE_BASE_URL,imageConfigured:!!process.env.IMAGE_MODEL});
 if(entity==="emulator-login"&&method==="POST"){
  if(appMode()!=="emulator"||process.env.NODE_ENV==="production"||!["127.0.0.1","localhost"].includes(req.nextUrl.hostname))throw new AppError(403,"Không cho phép đăng nhập thử ở môi trường này.");
  if(req.headers.get("origin")&&req.headers.get("origin")!==req.nextUrl.origin)throw new AppError(403,"Nguồn không hợp lệ.");const {adminAuth,firestore}=await import("@/lib/firebase/admin");const uid=process.env.OWNER_UID??"local-owner";await firestore().doc("config/access").set({ownerUid:uid});return reply({token:await adminAuth().createCustomToken(uid)});
 }
 const uid=await authorize(req);
 if(entity==="me"&&method==="GET")return reply({uid,mode:appMode()});
 if(entity==="workspace"&&method==="GET")return reply(await withDatabase(uid,db=>db));
 if(entity==="products"){
  if(method==="GET")return reply(await withDatabase(uid,db=>id?db.products.find(p=>p.id===id)??null:db.products));
  const input=await body(req);const data=productSchema.parse(input);
  return reply(await withDatabase(uid,db=>{if(method==="POST"&&!id){if(db.products.length>=100)throw new AppError(400,"Tối đa 100 sản phẩm.");const p={...data,id:randomUUID(),revision:1,archivedAt:null};db.products.push(p);return p;}if(method==="PATCH"&&id){const p=db.products.find(p=>p.id===id);if(!p)throw new AppError(404,"Không tìm thấy sản phẩm.");if(p.revision!==input.expectedRevision)throw new AppError(409,"Sản phẩm đã thay đổi. Hãy tải lại.");Object.assign(p,data,{revision:p.revision+1});return p;}throw new AppError(405,"Thao tác không được hỗ trợ.");}));
 }
 if(entity==="sources"){
  if(method==="GET")return reply(await withDatabase(uid,db=>db.sources));const input=await body(req);const data=sourceSchema.parse(input);return reply(await withDatabase(uid,db=>{if(method==="POST"){if(db.sources.length>=100)throw new AppError(400,"Tối đa 100 nguồn.");const s={...data,id:randomUUID(),revision:1};db.sources.push(s);return s;}const s=db.sources.find(s=>s.id===id);if(!s)throw new AppError(404,"Không tìm thấy nguồn.");if(s.revision!==input.expectedRevision)throw new AppError(409,"Nguồn đã thay đổi.");Object.assign(s,data,{revision:s.revision+1});return s;}));
 }
 if(entity==="settings"){
  if(method==="GET")return reply(await withDatabase(uid,db=>db.settings));const data=settingsSchema.parse(await body(req));return reply(await withDatabase(uid,db=>{db.settings=data;return db.settings;}));
 }
 if(entity==="logo"&&method==="POST"){
  if(Number(req.headers.get("content-length")??0)>6*1024*1024)throw new AppError(413,"Logo tối đa 5 MB.");const form=await req.formData();const file=form.get("file");if(!(file instanceof File)||file.size>5*1024*1024)throw new AppError(400,"Chọn logo PNG/JPEG/WebP tối đa 5 MB.");let bytes:Buffer;try{bytes=await validateLogo(Buffer.from(await file.arrayBuffer()));}catch(e){throw new AppError(400,e instanceof Error?e.message:"Logo không hợp lệ.");}const aid=randomUUID();const p=`brand/${aid}.png`;await saveBlob(uid,p,bytes,"image/png");await withDatabase(uid,db=>{db.assets.push({id:aid,campaignId:"brand",contentId:"",contentVersion:0,kind:"logo",storagePath:p,mimeType:"image/png",width:0,height:0,createdAt:now(),origin:"template",jobId:""});db.settings.logoAssetId=aid;return true;});return reply({id:aid});
 }
 if(entity==="campaigns"){
  if(method==="POST"&&!id){const data=await body(req);return reply(await withDatabase(uid,db=>{if(db.campaigns.length>=100)throw new AppError(400,"Tối đa 100 chiến dịch trong phiên bản này.");return createCampaign(db,data);}),201);}
  if(method==="GET"&&!resource)return reply(await withDatabase(uid,db=>id?db.campaigns.find(c=>c.id===id)??null:db.campaigns));
  if(method==="PATCH"&&id&&!resource){const input=await body(req);return reply(await withDatabase(uid,db=>{const c=db.campaigns.find(c=>c.id===id);if(!c)throw new AppError(404,"Không tìm thấy chiến dịch.");if(input.expectedRevision!==c.revision)throw new AppError(409,"Chiến dịch đã thay đổi.");if(input.action==="archive"){c.archivedAt=c.archivedAt?null:now();c.revision++;return c;}if(input.action==="duplicate")return createCampaign(db,{...c,topic:c.topic+" (bản sao)"});throw new AppError(400,"Thao tác không hợp lệ.");}));}
  if(resource==="contents"&&rid){const input=await body(req);return reply(await withDatabase(uid,db=>{const c=db.campaigns.find(c=>c.id===id);const content=c?.contents.find(x=>x.id===rid);if(!c||!content)throw new AppError(404,"Không tìm thấy nội dung.");if(action==="approve"){const next=approveContent(content,input.version);c.contents[c.contents.indexOf(content)]=next;c.revision++;return next;}return editCampaignContent(db,id,rid,z.number().int().parse(input.expectedVersion),z.string().parse(input.body));}));}
  if(resource==="jobs"&&method==="POST"){
   const input=await body(req);
   if(rid){return reply(await withDatabase(uid,db=>{const j=db.jobs.find(j=>j.id===rid&&j.campaignId===id);if(!j)throw new AppError(404,"Không tìm thấy công việc.");if(action==="cancel"){if(j.status==="queued"||j.status==="running"){j.status="cancelled";j.stage="Đã hủy các bước chưa hoàn tất";const c=db.campaigns.find(c=>c.id===id);if(c)c.status="review";}return j;}if(action==="retry"){if(j.status!=="failed")throw new AppError(409,"Chỉ thử lại công việc thất bại chưa phát sinh gọi trả phí.");const c=db.campaigns.find(c=>c.id===id)!;return queueJob(db,id,req.headers.get("idempotency-key")??"",{type:j.type,revision:c.revision,contentId:j.contentId,version:j.version,background:j.background});}throw new AppError(400,"Thao tác không hợp lệ.");}),202);}
   const data=z.object({type:z.enum(["draft","image"]),revision:z.number().int(),contentId:z.string().optional(),version:z.number().int().optional(),background:z.enum(["geometric","ai"]).optional()}).parse(input);
   const j=await withDatabase(uid,db=>queueJob(db,id,req.headers.get("idempotency-key")??"",data));let warning:string|undefined;try{await publishJob(uid,j.id);}catch(e){warning=e instanceof Error?e.message:"Chưa gửi được hàng đợi.";}return reply({jobId:j.id,status:j.status,warning},202);
  }
  if(resource==="export"&&method==="GET"){
   const c=await withDatabase(uid,db=>db.campaigns.find(c=>c.id===id)??null);if(!c)throw new AppError(404,"Không tìm thấy chiến dịch.");const text=`SỔ NỘI DUNG\n${c.topic}\n\n${c.contents.map(x=>`${x.channel} · ${x.reviewStatus==='approved'?'Đã duyệt':'Chưa duyệt'} · Phiên bản ${x.currentVersion}\n${x.versions.at(-1)!.body}`).join('\n\n---\n\n')}`;return new NextResponse('\ufeff'+text,{headers:{"Content-Type":"text/plain;charset=utf-8","Content-Disposition":"attachment; filename=chien-dich.txt","Cache-Control":"private,no-store"}});
  }
  if(resource==="assets"&&rid&&method==="GET"){
   const asset=await withDatabase(uid,db=>db.assets.find(a=>a.id===rid&&a.campaignId===id)??null);if(!asset)throw new AppError(404,"Không tìm thấy tệp.");const bytes=await readBlob(uid,asset.storagePath);return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":asset.mimeType,"Cache-Control":"private,no-store","X-Content-Type-Options":"nosniff",...(action==="download"?{"Content-Disposition":`attachment; filename=anh-${asset.id}.png`}:{})}});
  }
 }
 throw new AppError(404,"Không tìm thấy chức năng.");
}catch(e){if(e instanceof AppError)return reply({error:e.message,code:e.code},e.status);if(e instanceof ZodError)return reply({error:e.issues.map(x=>x.message).join('; '),code:"VALIDATION_ERROR"},400);console.error("API error:",e instanceof Error?e.name:"unknown");return reply({error:"Không xử lý được yêu cầu. Hãy kiểm tra cấu hình hoặc thử lại.",code:"INTERNAL_ERROR"},500);}}
export { handle as GET, handle as POST, handle as PATCH };
