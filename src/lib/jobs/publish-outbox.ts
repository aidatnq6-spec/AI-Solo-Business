import { CloudTasksClient } from "@google-cloud/tasks";
import { AppError } from "../domain/schemas";
export async function publishJob(uid:string,jobId:string){
 if((process.env.APP_MODE??"demo")!=="firebase")return;
 const project=process.env.CLOUD_TASKS_PROJECT,location=process.env.CLOUD_TASKS_LOCATION,queue=process.env.CLOUD_TASKS_QUEUE,url=process.env.WORKER_URL,email=process.env.WORKER_SERVICE_ACCOUNT;
 if(!project||!location||!queue||!url||!email)throw new AppError(503,"Chưa cấu hình hàng đợi. Công việc đã lưu và đang chờ kết nối worker.");
 const client=new CloudTasksClient();try{await client.createTask({parent:client.queuePath(project,location,queue),task:{name:client.taskPath(project,location,queue,jobId),httpRequest:{httpMethod:"POST",url:`${url}/jobs`,headers:{"Content-Type":"application/json"},body:Buffer.from(JSON.stringify({uid,jobId})).toString("base64"),oidcToken:{serviceAccountEmail:email,audience:url}},dispatchDeadline:{seconds:180}}});}catch(e){if((e as {code:number}).code!==6)throw e;}
}
