export type LogEntry = { session_id: string; started_at: number; type: string; elapsed_seconds: number | null; payload: string; source_event_id: string | null };
type Cell = string | number | null;
export function templateLogRows(entries: LogEntry[], fallbackMatchup: string): Cell[][] {
  const rows: Cell[][] = [];
  const goals = new Map<string, { row: Cell[]; time: number | null }>();
  const periodRows = new Map<string,Cell[]>();
  const pendingStarts = new Map<string,number>();
  const duration = (seconds: number | null) => seconds == null ? null : seconds / 86400;
  const periodValue = (period: string) => (({ "1st": 1, "2nd": 2, "3rd": 3 } as Record<string,number>)[period] || period);
  for (const entry of entries) {
    const detail = JSON.parse(entry.payload) as Record<string,string>;
    const matchup = detail.matchup || fallbackMatchup;
    const period = detail.period || "";
    if (!periodRows.has(entry.session_id)) {
      const first: Cell[] = [null,matchup,"Period","","","","",null,0,null,1];
      rows.push(first); periodRows.set(entry.session_id,first);
    }
    if (["Goal", "Goal update", "Existing goal"].includes(entry.type)) {
      const key = `${entry.session_id}:${entry.source_event_id}`;
      const existing = goals.get(key);
      const time = existing ? existing.time : entry.elapsed_seconds;
      const values: Cell[] = [null,matchup,"goal",detail.team||"",detail.scorerNumber||"",detail.assist1Number||"",detail.assist2Number||"",duration(time),null,null,periodValue(period)];
      if (existing) { existing.row.splice(0,11,...values); }
      else { rows.push(values); goals.set(key,{row:values,time}); }
    } else if (entry.type === "Clock started") {
      const current = periodRows.get(entry.session_id)!;
      if (current[10] === periodValue(period) && current[9] == null) current[9] = duration(entry.elapsed_seconds);
      else if (current[10] !== periodValue(period) && entry.elapsed_seconds != null && !pendingStarts.has(`${entry.session_id}:${period}`)) pendingStarts.set(`${entry.session_id}:${period}`,entry.elapsed_seconds);
    } else if (entry.type === "Period change") {
      const next: Cell[] = [null,matchup,"Period","","","","",null,duration(entry.elapsed_seconds),duration(pendingStarts.get(`${entry.session_id}:${period}`) ?? null),periodValue(period)];
      rows.push(next); periodRows.set(entry.session_id,next);
      pendingStarts.delete(`${entry.session_id}:${period}`);
    }
  }
  return rows;
}
