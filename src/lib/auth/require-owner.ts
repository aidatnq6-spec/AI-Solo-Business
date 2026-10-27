import { AppError } from "../domain/schemas";
export function appMode(){return process.env.APP_MODE??"demo";}
export async function authorize(req:Request){
 const url=new URL(req.url);const origin=req.headers.get("origin");if(!["GET","HEAD"].includes(req.method)&&origin&&origin!==url.origin)throw new AppError(403,"Yêu cầu từ nguồn không được phép.");
 if(appMode()==="demo"){
  if(process.env.NODE_ENV==="production"||!["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new AppError(403,"Chế độ demo chỉ chạy trên máy cá nhân khi phát triển.");
  return process.env.OWNER_UID??"local-owner";
 }
 const token=req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];if(!token)throw new AppError(401,"Bạn cần đăng nhập.");
 try{const {adminAuth}=await import("../firebase/admin");const user=await adminAuth().verifyIdToken(token,true);if(!process.env.OWNER_UID||user.uid!==process.env.OWNER_UID)throw new AppError(403,"Tài khoản này không có quyền sử dụng.");return user.uid;}catch(e){if(e instanceof AppError)throw e;throw new AppError(401,"Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.");}
}
