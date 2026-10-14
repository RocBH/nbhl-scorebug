import { env } from "cloudflare:workers";
import { getControlUser } from "@/lib/control-access";
import { eventLogsXlsx } from "@/lib/event-log-xlsx";
import { templateLogRows, type LogEntry } from "@/lib/template-log-rows";
import { decodeSingleQuotedJavaScript } from "@/lib/nbhl-source";
export async function GET(request: Request) {
  if (!(await getControlUser())) return Response.json({ error: "Control board access required." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  let ids = [...new Set((params.get("ids") || params.get("id") || "").split(",").filter(Boolean))];
  if ((!ids.length && params.get("all") !== "1") || ids.some(id => !/^\d{1,10}$/.test(id))) return Response.json({ error: "Select valid game numbers." }, { status: 400 });
  const goalsOnly = params.get("mode") === "goals";
  try {
    const db = env.DB;
    if (!db) throw new Error("Game log storage unavailable");
    if (params.get("all") === "1") {
      const available = await db.prepare("SELECT DISTINCT game_id FROM game_event_logs ORDER BY game_id").all<{game_id:string}>();
      ids = available.results.map(row => row.game_id);
      if (!ids.length) return Response.json({ error:"No saved games yet." }, { status:400 });
    }
    const result = await db.prepare(`SELECT l.*,s.started_at FROM game_event_logs l JOIN log_sessions s ON s.id=l.session_id WHERE l.game_id IN (SELECT value FROM json_each(?)) ORDER BY s.started_at,l.updated_at,l.rowid`).bind(JSON.stringify(ids)).all<LogEntry & {game_id:string}>();
    const sheets: {name:string; rows:(string|number|null)[][]}[] = [];
    for (const gameId of ids) {
      const entries = result.results.filter(row => row.game_id === gameId);
      let matchup = entries.map(row => (JSON.parse(row.payload) as Record<string,string>).matchup).find(Boolean) || "";
      if (!matchup) {
        try {
          const response = await fetch(`https://thenbhl.com/scores/game-${gameId}`, { cache:"no-store", signal:AbortSignal.timeout(8000) });
          if (!response.ok) throw new Error("Matchup unavailable");
          const match = (await response.text()).match(/var\s+__gameDetails__\s*=\s*'((?:\\.|[^'\\])*)';/);
          if (!match) throw new Error("Matchup unavailable");
          const game = JSON.parse(decodeSingleQuotedJavaScript(match[1])) as { visitorTeamName:string; localTeamName:string };
          matchup = `${game.visitorTeamName} vs ${game.localTeamName}`;
        } catch { matchup = `Game ${gameId}`; }
      }
      const rows = templateLogRows(entries,matchup);
      sheets.push({name:matchup,rows:goalsOnly ? rows.filter(row => row[2] === "goal") : rows});
    }
    const bytes = eventLogsXlsx(sheets);
    const filename = ids.length === 1 ? `${sheets[0].name.replace(/[^\w .-]/g,"_").slice(0,150)}${goalsOnly?" - goals":""}.xlsx` : `NBHL-${ids.length}-games${goalsOnly?"-goals":""}.xlsx`;
    return new Response(bytes, { headers: { "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition":`attachment; filename="${filename}"`, "Cache-Control":"no-store" } });
  } catch (error) { console.error("Excel event export failed",error); return Response.json({ error:"Could not download the event log. Try again." }, { status:500 }); }
}
