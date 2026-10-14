"use client";
import { useEffect,useMemo,useState } from "react";
import {filterSchedule,type ScheduleGame} from "@/lib/nbhl-schedule";
type Season={id:string;name:string};
export default function GameFinder({queue,onAdded}:{queue:string[];onAdded:()=>Promise<void>}) {
  const [season,setSeason]=useState("15861"),[seasons,setSeasons]=useState<Season[]>([]),[games,setGames]=useState<ScheduleGame[]>([]),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[refresh,setRefresh]=useState(0),[selected,setSelected]=useState<Set<string>>(new Set()),[limit,setLimit]=useState(50);
  const [filters,setFilters]=useState({from:"",to:"",division:"",rink:"",team:""});
  useEffect(()=>{const abort=new AbortController();setLoading(true);setError("");setGames([]);setSelected(new Set());setFilters({from:"",to:"",division:"",rink:"",team:""});setLimit(50);
    fetch(`/api/schedule?season=${season}`,{signal:abort.signal,cache:"no-store"}).then(async response=>{const data=await response.json() as {games:ScheduleGame[];seasons:Season[];error?:string};if(!response.ok)throw new Error(data.error||"Could not load schedule.");setGames(data.games);setSeasons(data.seasons);}).catch(error=>{if(!abort.signal.aborted)setError(error.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});return()=>abort.abort();
  },[season,refresh]);
  const loaded=new Set(queue);
  const filtered=useMemo(()=>filterSchedule(games,filters),[games,filters]);
  const divisions=new Map<string,string>(),rinks=new Map<string,string>(),teams=new Map<string,string>();
  games.forEach(game=>{game.divisions.forEach(division=>divisions.set(division.id,division.name));if(game.rinkId)rinks.set(game.rinkId,game.rink);if(game.homeId)teams.set(game.homeId,game.home);if(game.visitorId)teams.set(game.visitorId,game.visitor);});
  const options=(items:Map<string,string>)=>[...items].sort((a,b)=>a[1].localeCompare(b[1])).map(([id,name])=><option key={id} value={id}>{name}</option>);
  function change(key:keyof typeof filters,value:string){setFilters(current=>({...current,[key]:value}));setLimit(50);setMessage("");}
  const toAdd=games.filter(game=>selected.has(game.id)&&!loaded.has(game.id));
  async function add(){setSaving(true);setMessage("");try{const response=await fetch("/api/settings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"appendQueue",games:toAdd.map(game=>game.id)})});const data=await response.json() as {error?:string;added:number};if(!response.ok)throw new Error(data.error||"Could not add games.");await onAdded();setSelected(new Set());setMessage(`${data.added} game${data.added===1?"":"s"} added to the queue.`);}catch(error){setMessage(error instanceof Error?error.message:"Could not add games.");}finally{setSaving(false);}}
  function time(value:string){const parts=value.split(":");if(parts.length<2)return "Time unavailable";const hour=Number(parts[0]);return `${hour%12||12}:${parts[1]} ${hour>=12?"PM":"AM"}`;}
  return <section className="game-finder"><h2>Find NBHL games</h2>
    <div className="finder-season"><label>Season<select value={season} onChange={event=>setSeason(event.target.value)} disabled={saving}>{!seasons.length&&<option value="15861">2026 NBHL Championships</option>}{seasons.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" disabled={loading||saving} onClick={()=>setRefresh(value=>value+1)}>Refresh schedule</button></div>
    <div className="finder-filters">
      <label>From date<input type="date" value={filters.from} onChange={event=>change("from",event.target.value)}/></label><label>Through date<input type="date" min={filters.from||undefined} value={filters.to} onChange={event=>change("to",event.target.value)}/></label>
      <label>Division<select value={filters.division} onChange={event=>change("division",event.target.value)}><option value="">All divisions</option>{options(divisions)}</select></label>
      <label>Location / rink<select value={filters.rink} onChange={event=>change("rink",event.target.value)}><option value="">All locations</option>{options(rinks)}</select></label>
      <label>Team<select value={filters.team} onChange={event=>change("team",event.target.value)}><option value="">All teams</option>{options(teams)}</select></label>
    </div>
    <div className="finder-actions"><button type="button" disabled={saving||loading||!filtered.some(game=>!loaded.has(game.id))} onClick={()=>setSelected(current=>new Set([...current,...filtered.filter(game=>!loaded.has(game.id)).map(game=>game.id)]))}>Select matching games</button><button type="button" disabled={saving||!selected.size} onClick={()=>setSelected(new Set())}>Clear selection</button><button type="button" disabled={saving||loading||!toAdd.length} onClick={()=>void add()}>{saving?"Adding…":`Add ${toAdd.length} selected to queue`}</button></div>
    {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
    {loading?<p>Loading NBHL schedule…</p>:!error&&<><p>{filtered.length} matching game{filtered.length===1?"":"s"} · Sorted by date and start time</p>{filters.from&&filters.to&&filters.from>filters.to?<p>Select an end date on or after the start date.</p>:!filtered.length&&<p>No games match these filters.</p>}<ul className="finder-games">{filtered.slice(0,limit).map(game=><li key={game.id}><label><input type="checkbox" checked={loaded.has(game.id)||selected.has(game.id)} disabled={saving||loaded.has(game.id)} onChange={event=>setSelected(current=>{const next=new Set(current);if(event.target.checked)next.add(game.id);else next.delete(game.id);return next;})}/><span><strong>{game.visitor} vs. {game.home}</strong><small>{game.date} · {time(game.time)} · {game.rink}</small><small>{game.divisions.map(division=>division.name).join(" / ")} · {loaded.has(game.id)?"Already loaded":game.status}</small></span></label></li>)}</ul>{limit<filtered.length&&<button type="button" onClick={()=>setLimit(value=>value+50)}>Show more games</button>}</>}
  </section>;
}
