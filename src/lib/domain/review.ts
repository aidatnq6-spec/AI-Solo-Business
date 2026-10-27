import { randomUUID } from "node:crypto";
import { AppError, now, type Channel, type Content } from "./schemas";
export function createContent(channel:Channel,kind:Content["kind"],body:string,issues:string[]=[],origin:"ai"|"demo"="demo",sourceRefs:string[]=[]):Content{return {id:randomUUID(),channel,kind,currentVersion:1,reviewStatus:issues.length?"needs_verification":"draft",approvedVersion:null,versions:[{version:1,body,createdAt:now(),origin,sourceRefs,issues}]};}
export function editContent(content:Content,expected:number,body:string):Content{
 if(expected!==content.currentVersion)throw new AppError(409,"Nội dung đã thay đổi. Hãy tải phiên bản mới.");
 if(!body.trim()||body.length>12000)throw new AppError(400,"Nội dung cần từ 1 đến 12.000 ký tự.");
 if(content.versions.length>=20)throw new AppError(400,"Đã đạt 20 phiên bản. Hãy nhân bản chiến dịch để tiếp tục.");
 const c=structuredClone(content);const v=c.versions.at(-1)!;c.currentVersion++;c.approvedVersion=null;c.reviewStatus=v.issues.length?"needs_verification":"draft";c.versions.push({...v,version:c.currentVersion,body,origin:"manual",createdAt:now()});return c;
}
export function approveContent(content:Content,version:number):Content{
 if(version!==content.currentVersion)throw new AppError(409,"Chỉ duyệt được phiên bản hiện tại.");
 if(content.versions.at(-1)!.issues.length)throw new AppError(409,"Hãy xử lý các thông tin cần xác minh trước khi duyệt.");
 return {...structuredClone(content),reviewStatus:"approved",approvedVersion:version};
}
export function requireApproved(c:Content|undefined,v:number|undefined){if(!c||v!==c.currentVersion||c.approvedVersion!==v||c.reviewStatus!=="approved")throw new AppError(409,"Cần duyệt đúng phiên bản hiện tại trước khi tạo ảnh.");return c.versions.at(-1)!;}
