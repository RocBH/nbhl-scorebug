import { getControlUser } from "@/lib/control-access";
import { normalizeSchedule, type RawScheduleGame } from "@/lib/nbhl-schedule";
export async function GET(request:Request) {
  if(!(await getControlUser()))return Response.json({error:"Control board access required."},{status:403});
  const season=new URL(request.url).searchParams.get("season")||"15861";
  if(!/^\d{1,10}$/.test(season))return Response.json({error:"Invalid season."},{status:400});
  try {
    async function source(path:string) { const response=await fetch(`https://thenbhl.com/api/v2/solutions/22569/${path}`,{cache:"no-store",signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`NBHL returned ${response.status}`);const data=await response.json();if(!Array.isArray(data))throw new Error("Invalid NBHL schedule");return data; }
    const [games,seasons]=await Promise.all([source(`seasons/${season}/schedule`),source("seasons")]);
    return Response.json({games:normalizeSchedule(games as RawScheduleGame[]),seasons:(seasons as {Id:number;Name:string}[]).map(item=>({id:String(item.Id),name:item.Name})),season},{headers:{"Cache-Control":"private, max-age=60"}});
  }catch(error){console.error("NBHL schedule unavailable",error);return Response.json({error:"NBHL’s schedule is temporarily unavailable. Try refreshing or use game URLs in Setup."},{status:502});}
}
