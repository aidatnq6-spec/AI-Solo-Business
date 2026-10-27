import { randomUUID } from "node:crypto";
import { withDatabase, saveBlob, readBlob } from "../../../src/lib/repositories/store";
import { claimJob, finishJob, applyDraftResults } from "../../../src/lib/domain/workflow";
import { createContent, requireApproved } from "../../../src/lib/domain/review";
import { checkSources, verificationIssues } from "../../../src/lib/domain/sources";
import { now, type Job, type Asset } from "../../../src/lib/domain/schemas";
import { renderPoster } from "../../../src/lib/media/poster";
import { draft } from "./providers/text";
import { imageBackground } from "./providers/image";
import { publishJob } from "../../../src/lib/jobs/publish-outbox";
export async function processJob(uid:string,id:string){
 const job=await withDatabase(uid,db=>{const j=db.jobs.find(j=>j.id===id);return j&&claimJob(j)?j:null;});if(!job)return;
 const stage=async(text:string,paid=false)=>withDatabase(uid,db=>{const j=db.jobs.find(x=>x.id===id)!;if(j.status==="cancelled")throw new Error("Công việc đã hủy.");j.stage=text;if(paid)j.providerStarted=true;return true;});
 try{
  if(job.type==="draft"){
   await stage("Đang soạn nội dung cho từng kênh",(process.env.AI_MODE??"demo")!=="demo");const result=await draft(job.input,async providerId=>{await withDatabase(uid,db=>{db.jobs.find(x=>x.id===id)!.providerRequestId=providerId;return true;});});
   const items=result.items.map(item=>{checkSources(item.sourceRefs,job.input.sourceSnapshots);const issues=[...item.issues,...verificationIssues(item.body,job.input.sourceSnapshots,job.input.productSnapshot.price!==undefined,!!job.input.productSnapshot.offer)];return createContent(item.channel,item.kind,item.body,[...new Set(issues)],result.mode==="demo"?"demo":"ai",item.sourceRefs);});
   await withDatabase(uid,db=>{const j=db.jobs.find(x=>x.id===id)!;if(j.status==="cancelled")return false;const c=db.campaigns.find(x=>x.id===j.campaignId)!;if(c.revision!==job.input.revision)throw new Error("Đề bài đã thay đổi. Kết quả không được ghi đè.");applyDraftResults(c,items);j.outputIds=c.contents.map(x=>x.id);finishJob(j);db.usage.push({id:randomUUID(),jobId:id,createdAt:now(),mode:result.mode,model:result.model,cost:null});return true;});
  }else{
   const content=job.input.contents.find(x=>x.id===job.contentId);const version=requireApproved(content,job.version);await stage("Đang dựng ảnh từ phiên bản đã duyệt",job.background==="ai");const brand=await withDatabase(uid,db=>db.settings);const background=job.background==="ai"?await imageBackground(job.input.productSnapshot.name):undefined;let logo:Buffer|undefined;
   if(brand.logoAssetId){const asset=await withDatabase(uid,db=>db.assets.find(a=>a.id===brand.logoAssetId)??null);if(asset)logo=await readBlob(uid,asset.storagePath);}
   const bytes=await renderPoster({title:job.input.topic,product:job.input.productSnapshot.name,brand:brand.brandName,contact:brand.contact,logo,background});const assetId=job.id;const storagePath=`campaigns/${job.campaignId}/${assetId}.png`;await saveBlob(uid,storagePath,bytes,"image/png");
   await withDatabase(uid,db=>{const j=db.jobs.find(x=>x.id===id)!;if(j.status==="cancelled")return false;const asset:Asset={id:assetId,campaignId:job.campaignId,contentId:content!.id,contentVersion:version.version,kind:"image",storagePath,mimeType:"image/png",width:1080,height:1080,createdAt:now(),origin:job.background==="ai"?"ai":"template",jobId:id};if(!db.assets.some(a=>a.id===assetId))db.assets.push(asset);j.outputIds=[assetId];finishJob(j);return true;});
  }
 }catch(error){await withDatabase(uid,db=>{const j=db.jobs.find(x=>x.id===id)!;if(j.status==="cancelled")return false;j.status=j.providerStarted?"needs_reconciliation":"failed";j.error=error instanceof Error?error.message.slice(0,300):"Xử lý thất bại.";j.leaseExpiresAt=0;const c=db.campaigns.find(c=>c.id===j.campaignId);if(c)c.status="review";return true;});}
}
export async function tick(uid:string){const jobs=await withDatabase(uid,db=>db.jobs.filter(j=>j.status==="queued"||(j.status==="running"&&j.leaseExpiresAt<Date.now())).map(j=>j.id));for(const id of jobs)await processJob(uid,id);}
async function main(){const uid=process.env.OWNER_UID??"local-owner";console.log("Content worker: ready; data mode="+(process.env.APP_MODE??"demo")+", AI mode="+(process.env.AI_MODE??"demo"));while(true){try{if(process.env.APP_MODE==="firebase"){const pending=await withDatabase(uid,db=>db.jobs.filter(j=>j.status==="queued"&&!j.dispatched));for(const job of pending){await publishJob(uid,job.id);await withDatabase(uid,db=>{db.jobs.find(j=>j.id===job.id)!.dispatched=true;return true;});}}else await tick(uid);}catch(e){console.error("Worker:",e instanceof Error?e.message:"failed");}await new Promise(r=>setTimeout(r,1500));}}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/run.ts'))void main();
