import { describe, expect, it } from "vitest";
import { productSchema, campaignInputSchema } from "@/lib/domain/schemas";
import { approveContent, editContent, createContent, requireApproved } from "@/lib/domain/review";
import { checkSources } from "@/lib/domain/sources";

describe("input contracts", () => {
  it("allows a product without invented price", () => { expect(productSchema.parse({name:"Chữ ký số",category:"signature"}).price).toBeUndefined(); });
  it("rejects an empty channel selection", () => { expect(campaignInputSchema.safeParse({productId:"p",topic:"Gia hạn chữ ký số",channels:[]}).success).toBe(false); });
  it("rejects duplicate channels", () => { expect(campaignInputSchema.safeParse({productId:"p",topic:"Gia hạn chữ ký số",channels:["facebook","facebook"]}).success).toBe(false); });
});
describe("review and immutable versions", () => {
  it("requires approval again after an edit", () => { const first=createContent("facebook","post","Bản đầu");const approved=approveContent(first,1);const edited=editContent(approved,1,"Bản sửa");expect(edited.reviewStatus).toBe("draft");expect(edited.versions[0].body).toBe("Bản đầu");expect(edited.currentVersion).toBe(2); });
  it("rejects stale review and edits", () => {const c=editContent(createContent("zalo","post","A"),1,"B");expect(()=>approveContent(c,1)).toThrow();expect(()=>editContent(c,1,"C")).toThrow();});
  it("blocks unresolved claims and unapproved media", () => {const c=createContent("youtube","script","A",["Thiếu nguồn"]);expect(()=>approveContent(c,1)).toThrow();expect(()=>requireApproved(c,1)).toThrow();});
  it("does not mutate a saved source version",()=>{const a=createContent("tiktok","script","A");const b=approveContent(a,1);expect(a.reviewStatus).toBe("draft");expect(b.reviewStatus).toBe("approved");});
});
describe("source guard",()=>{
 it("rejects references that were not provided",()=>{expect(()=>checkSources(["invented"],[])).toThrow();});
});
