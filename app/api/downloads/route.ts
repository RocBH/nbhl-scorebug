import { env } from "cloudflare:workers";
import { getControlUser } from "@/lib/control-access";
export async function GET() {
  if (!(await getControlUser())) return Response.json({ error:"Control board access required." },{status:403});
  try {
    const db=env.DB;
    if (!db) throw new Error("Storage unavailable");
    const result=await db.prepare(`SELECT game_id,MAX(updated_at) AS updated_at,COUNT(DISTINCT session_id || ':' || source_event_id) AS goals,MAX(CASE WHEN json_extract(payload,'$.matchup') IS NOT NULL THEN json_extract(payload,'$.matchup') END) AS matchup FROM game_event_logs GROUP BY game_id ORDER BY updated_at DESC`).all();
    return Response.json({games:result.results},{headers:{"Cache-Control":"no-store"}});
  } catch { return Response.json({error:"Could not load saved games. Try again."},{status:500}); }
}
