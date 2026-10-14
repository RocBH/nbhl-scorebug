import { env } from "cloudflare:workers";
type Player = { id: number; number?: string; name?: string; firstName?: string; lastName?: string };
type Stat = { statTypeId: number; playerId: number; number?: string; firstName?: string; lastName?: string; name?: string };
type SourceEvent = { id: number; eventTypeId: number; periodId?: number; teamId: number; time?: string; timeValue?: string; statList?: Stat[] };
type SourceGame = { id: number; localTeamId: number; visitorTeamId: number; localTeamName?: string; visitorTeamName?: string; eventList?: SourceEvent[]; teamList?: { id: number; name?: string; fullName?: string; players?: Player[] }[] };
export type GoalDetail = { team: string; period: string; scorer: string; scorerNumber: string; assist1: string; assist1Number: string; assist2: string; assist2Number: string; websiteTime: string; matchup: string };
export function periodName(period: number) { return period === 99 ? "Final" : period === 9 ? "S/O" : period > 3 ? "OT" : period === 2 ? "2nd" : period === 3 ? "3rd" : "1st"; }
export function goalDetails(game: SourceGame) {
  const teams = game.teamList || [];
  return (game.eventList || []).filter(event => event.eventTypeId === 1).map(event => {
    const team = teams.find(team => team.id === event.teamId);
    function player(stat?: Stat) {
      const roster = team?.players?.find(player => player.id === stat?.playerId);
      return { name: roster?.name || [roster?.firstName || stat?.firstName, roster?.lastName || stat?.lastName].filter(Boolean).join(" ") || stat?.name || "", number: roster?.number || stat?.number || "" };
    }
    const scorer = player(event.statList?.find(stat => stat.statTypeId === 6));
    const assists = (event.statList || []).filter(stat => stat.statTypeId === 7).map(stat => player(stat));
    const detail: GoalDetail = { matchup: `${game.visitorTeamName || teams.find(t => t.id === game.visitorTeamId)?.name || "Visitor"} vs ${game.localTeamName || teams.find(t => t.id === game.localTeamId)?.name || "Home"}`, team: team?.name || team?.fullName || (event.teamId === game.localTeamId ? game.localTeamName : game.visitorTeamName) || "", period: periodName(event.periodId || 1), scorer: scorer.name, scorerNumber: scorer.number, assist1: assists[0]?.name || "", assist1Number: assists[0]?.number || "", assist2: assists[1]?.name || "", assist2Number: assists[1]?.number || "", websiteTime: event.timeValue || event.time || "" };
    return { id: String(event.id), detail };
  });
}
export async function recordGameEvents(game: SourceGame, startedAt: number, period: number, now = Date.now()) {
  const db = env.DB;
  if (!db) throw new Error("Game log storage unavailable");
  const gameId = String(game.id), sessionId = `${gameId}:${startedAt}`, elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const statements = [db.prepare("INSERT INTO log_sessions (id,game_id,started_at) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING").bind(sessionId,gameId,startedAt)];
  statements.push(db.prepare(`INSERT INTO game_event_logs (id,session_id,game_id,type,payload,received_at,elapsed_seconds,updated_at)
    SELECT ?,?,?, 'Game activated', ?,?,0,? WHERE NOT EXISTS (SELECT 1 FROM game_event_logs WHERE session_id=? AND type='Game activated')`).bind(crypto.randomUUID(),sessionId,gameId,JSON.stringify({ period: periodName(period), matchup: `${game.visitorTeamName || "Visitor"} vs ${game.localTeamName || "Home"}` }),startedAt,now,sessionId));
  for (const goal of goalDetails(game)) {
    const payload = JSON.stringify(goal.detail);
    statements.push(db.prepare(`INSERT INTO game_event_logs (id,session_id,game_id,source_event_id,type,payload,received_at,elapsed_seconds,updated_at)
      SELECT ?,?,?,?, CASE WHEN s.initialized=0 THEN 'Existing goal' WHEN EXISTS(SELECT 1 FROM game_event_logs WHERE session_id=? AND source_event_id=?) THEN 'Goal update' ELSE 'Goal' END, ?, CASE WHEN s.initialized=1 THEN ? ELSE NULL END, CASE WHEN s.initialized=1 THEN ? ELSE NULL END, ?
      FROM log_sessions s WHERE s.id=? AND (SELECT payload FROM game_event_logs WHERE session_id=? AND source_event_id=? ORDER BY updated_at DESC,rowid DESC LIMIT 1) IS NOT ?`).bind(crypto.randomUUID(),sessionId,gameId,goal.id,sessionId,goal.id,payload,now,elapsed,now,sessionId,sessionId,goal.id,payload));
  }
  statements.push(db.prepare(`INSERT INTO game_event_logs (id,session_id,game_id,type,payload,received_at,elapsed_seconds,updated_at)
    SELECT ?,?,?, 'Period change', ?,?,?,? FROM log_sessions WHERE id=? AND initialized=1 AND last_period IS NOT ?`).bind(crypto.randomUUID(),sessionId,gameId,JSON.stringify({ period: periodName(period), matchup: `${game.visitorTeamName || "Visitor"} vs ${game.localTeamName || "Home"}` }),now,elapsed,now,sessionId,period));
  statements.push(db.prepare("UPDATE log_sessions SET initialized=1,last_period=? WHERE id=?").bind(period,sessionId));
  await db.batch(statements);
}

export async function recordClockStart(gameId: string, startedAt: number, now = Date.now()) {
  const db = env.DB;
  if (!db) throw new Error("Game log storage unavailable");
  const sessionId = `${gameId}:${startedAt}`;
  const state = await db.prepare("SELECT COALESCE((SELECT period FROM game_overrides WHERE game_id=?),(SELECT last_period FROM log_sessions WHERE id=?),1) AS period").bind(gameId,sessionId).first<{ period:number }>();
  await db.batch([
    db.prepare("INSERT INTO log_sessions (id,game_id,started_at) VALUES (?,?,?) ON CONFLICT(id) DO NOTHING").bind(sessionId,gameId,startedAt),
    db.prepare("INSERT INTO game_event_logs (id,session_id,game_id,type,payload,received_at,elapsed_seconds,updated_at) VALUES (?,?,?,'Clock started',?,?,?,?)").bind(crypto.randomUUID(),sessionId,gameId,JSON.stringify({ period:periodName(state?.period || 1) }),now,Math.max(0,Math.floor((now-startedAt)/1000)),now),
  ]);
}
