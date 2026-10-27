import assert from 'node:assert/strict';
const base=process.env.SMOKE_URL??'http://127.0.0.1:3100';
async function api(path,method='GET',body){const r=await fetch(base+'/api/'+path,{method,headers:{'content-type':'application/json',...(method==='POST'?{'idempotency-key':crypto.randomUUID()}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=r.headers.get('content-type')?.includes('application/json')?await r.json():Buffer.from(await r.arrayBuffer());assert.ok(r.ok,`${r.status}: ${JSON.stringify(data)}`);return data;}
const db=await api('workspace');const campaign=await api('campaigns','POST',{productId:db.products[0].id,topic:'Kiểm tra quy trình nội dung: chuẩn bị trước khi gia hạn chữ ký số',channels:['facebook','tiktok','zalo','youtube'],cta:'Nhắn tin để được tư vấn.'});
await api(`campaigns/${campaign.id}/jobs`,'POST',{type:'draft',revision:campaign.revision});
let state;for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,500));state=await api('workspace');if(state.jobs.find(j=>j.campaignId===campaign.id)?.status==='succeeded')break;}
let c=state.campaigns.find(c=>c.id===campaign.id);assert.equal(c.contents.length,4,'four channel outputs');const first=c.contents[0];
await api(`campaigns/${c.id}/contents/${first.id}`,'PATCH',{expectedVersion:first.currentVersion,body:first.versions.at(-1).body+'\nĐã kiểm tra bản nháp.'});
state=await api('workspace');c=state.campaigns.find(x=>x.id===c.id);const edited=c.contents.find(x=>x.id===first.id);assert.equal(edited.reviewStatus,'draft');assert.equal(edited.versions.length,2);
await api(`campaigns/${c.id}/contents/${first.id}/approve`,'POST',{version:edited.currentVersion});
state=await api('workspace');c=state.campaigns.find(x=>x.id===c.id);await api(`campaigns/${c.id}/jobs`,'POST',{type:'image',revision:c.revision,contentId:first.id,version:edited.currentVersion,background:'geometric'});
for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,500));state=await api('workspace');if(state.assets.some(a=>a.campaignId===c.id))break;}
const asset=state.assets.find(a=>a.campaignId===c.id);assert.ok(asset,'PNG asset metadata');const bytes=await api(`campaigns/${c.id}/assets/${asset.id}/download`);assert.equal(bytes.subarray(1,4).toString(),'PNG');const txt=await api(`campaigns/${c.id}/export`);assert.ok(txt.toString('utf8').includes('Facebook')||txt.toString('utf8').includes('facebook'));
state=await api('workspace');c=state.campaigns.find(x=>x.id===c.id);await api(`campaigns/${c.id}`,'PATCH',{action:'archive',expectedRevision:c.revision});
console.log(JSON.stringify({status:'PASS',channels:4,versions:2,pngBytes:bytes.length,archivedSmokeCampaign:campaign.id}));
