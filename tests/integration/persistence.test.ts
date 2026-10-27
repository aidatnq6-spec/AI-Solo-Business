import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe,it,expect,vi,afterEach } from 'vitest';
import { withDatabase } from '@/lib/repositories/store';
import { createCampaign } from '@/lib/domain/workflow';
afterEach(()=>vi.unstubAllEnvs());
describe('server-side store',()=>{
 it('serializes concurrent writes without losing records',async()=>{vi.stubEnv('APP_MODE','demo');vi.stubEnv('NODE_ENV','test');const uid='test-'+crypto.randomUUID();try{await Promise.all(Array.from({length:5},(_,i)=>withDatabase(uid,db=>createCampaign(db,{productId:'signature',topic:'Kiểm tra dữ liệu '+i,channels:['facebook']}))));expect(await withDatabase(uid,db=>db.campaigns.length)).toBe(5);}finally{await rm(path.join(process.cwd(),'.data',uid+'.json'),{force:true});}});
});
