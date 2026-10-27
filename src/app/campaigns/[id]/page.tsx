import { Studio } from "@/components/studio";
export default async function CampaignPage({params}:{params:Promise<{id:string}>}){return <Studio campaignId={(await params).id}/>;}
