import { afterEach,describe,it,expect,vi } from 'vitest';
import { withDatabase } from '@/lib/repositories/store';
import { createCampaign, queueJob } from '@/lib/domain/workflow';
import { createContent } from '@/lib/domain/review';
afterEach(()=>vi.unstubAllEnvs());
describe('Firestore repository',()=>{
 it('persists normalized products, campaign versions and queued jobs',async()=>{vi.stubEnv('APP_MODE','emulator');const uid='repository-'+crypto.randomUUID();const c=await withDatabase(uid,db=>createCampaign(db,{productId:'signature',topic:'Kiểm tra lưu trữ Firestore',channels:['facebook']}));await withDatabase(uid,db=>{db.campaigns[0].contents=[createContent('facebook','post','Bản lưu thử')];return true;});const loaded=await withDatabase(uid,db=>db);expect(loaded.products).toHaveLength(3);expect(loaded.campaigns[0].contents[0].versions[0].body).toBe('Bản lưu thử');const j=await withDatabase(uid,db=>queueJob(db,c.id,'firestore-job',{type:'draft',revision:1}));expect((await withDatabase(uid,db=>db.jobs))[0].id).toBe(j.id);});
});
