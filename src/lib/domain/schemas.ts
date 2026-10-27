import { z } from "zod";
export const channels = ["facebook", "tiktok", "zalo", "youtube"] as const;
export type Channel = typeof channels[number];
export const channelNames: Record<Channel,string> = {facebook:"Facebook",tiktok:"TikTok",zalo:"Zalo",youtube:"YouTube"};
export const categories = {signature:"Chữ ký số",invoice:"Hóa đơn điện tử",insurance:"Giải pháp BHXH"};
export const productSchema = z.object({
  name:z.string().trim().min(2).max(120), category:z.enum(["signature","invoice","insurance"]),
  supplier:z.string().max(160).default(""), description:z.string().max(4000).default(""),
  features:z.array(z.string().max(250)).max(20).default([]), price:z.number().nonnegative().max(1e12).optional(),
  currency:z.literal("VND").default("VND"), offer:z.string().max(1000).default(""),
  confirmedAt:z.string().nullable().default(null), sourceIds:z.array(z.string()).max(10).default([]),
});
export type Product = z.infer<typeof productSchema> & {id:string;revision:number;archivedAt:string|null};
export const sourceSchema = z.object({title:z.string().trim().min(2).max(160),type:z.enum(["text","url_note"]).default("text"),text:z.string().trim().min(10).max(12000),url:z.string().max(1000).default("").refine(v=>!v||/^https?:\/\//i.test(v),"URL cần bắt đầu bằng https:// hoặc http://"),checkedAt:z.string().nullable().default(null),confirmedByOwner:z.boolean().default(false)});
export type Source = z.infer<typeof sourceSchema>&{id:string;revision:number};
export const campaignInputSchema = z.object({productId:z.string().min(1),topic:z.string().trim().min(5).max(300),goal:z.string().max(120).default("Nhận tin nhắn tư vấn"),cta:z.string().max(200).default("Nhắn tin để được tư vấn phù hợp."),tone:z.string().max(100).default("Rõ ràng, hữu ích, chuyên nghiệp"),channels:z.array(z.enum(channels)).min(1).max(4).refine(v=>new Set(v).size===v.length,"Kênh không được trùng"),sourceIds:z.array(z.string()).max(10).default([])});
export const settingsSchema=z.object({brandName:z.string().min(1).max(100),contact:z.string().max(200),defaultCta:z.string().max(200),tone:z.string().max(100),dailyAiCallLimit:z.number().int().min(1).max(100),logoAssetId:z.string().default("")});
export type Settings=z.infer<typeof settingsSchema>;
export type ContentVersion={version:number;body:string;createdAt:string;origin:"ai"|"manual"|"demo";sourceRefs:string[];issues:string[]};
export type Content={id:string;channel:Channel;kind:"post"|"script";currentVersion:number;reviewStatus:"draft"|"needs_verification"|"approved";approvedVersion:number|null;versions:ContentVersion[]};
export type Campaign=z.infer<typeof campaignInputSchema>&{id:string;revision:number;createdAt:string;archivedAt:string|null;status:"draft"|"generating"|"review"|"ready";productSnapshot:Product;sourceSnapshots:Source[];contents:Content[]};
export type Job={id:string;campaignId:string;type:"draft"|"image";status:"queued"|"running"|"succeeded"|"failed"|"needs_reconciliation"|"cancelled";stage:string;attempt:number;idempotencyKey:string;inputHash:string;input:Campaign;contentId?:string;version?:number;background:"geometric"|"ai";leaseExpiresAt:number;providerStarted:boolean;providerRequestId?:string;error?:string;createdAt:string;outputIds:string[];dispatched?:boolean};
export type Asset={id:string;campaignId:string;contentId:string;contentVersion:number;kind:"image"|"logo";storagePath:string;mimeType:string;width:number;height:number;createdAt:string;origin:"template"|"ai";jobId:string};
export type Usage={id:string;jobId:string;createdAt:string;mode:"demo"|"gateway";model:string;inputTokens?:number;outputTokens?:number;cost:null};
export type Database={products:Product[];sources:Source[];campaigns:Campaign[];jobs:Job[];assets:Asset[];usage:Usage[];settings:Settings};
export class AppError extends Error{constructor(public status:number,message:string,public code="INVALID_REQUEST"){super(message);}}
export const now=()=>new Date().toISOString();
