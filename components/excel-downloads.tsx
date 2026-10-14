"use client";
import { useEffect, useState } from "react";
type SavedGame={game_id:string;matchup:string|null;updated_at:number;goals:number};
export default function ExcelDownloads() {
  const [games,setGames]=useState<SavedGame[]>([]),[selected,setSelected]=useState<Set<string>>(new Set()),[goalsOnly,setGoalsOnly]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  async function refresh() {
    setLoading(true);setMessage("");
    try { const response=await fetch("/api/downloads",{cache:"no-store"});const data=await response.json() as {games?:SavedGame[];error?:string};if(!response.ok)throw new Error(data.error||"Could not load games.");setGames(data.games||[]); }
    catch(error){setMessage(error instanceof Error?error.message:"Could not load games.");}finally{setLoading(false);}
  }
  useEffect(()=>{const id=new URLSearchParams(window.location.search).get("game");if(id)setSelected(new Set([id]));void refresh();},[]);
  async function download(all=false) {
    setBusy(true);setMessage("");
    try {
      const ids=all?games.map(game=>game.game_id):games.filter(game=>selected.has(game.game_id)).map(game=>game.game_id);
      const params=new URLSearchParams(all ? {all:"1",mode:goalsOnly?"goals":"all"} : {ids:ids.join(","),mode:goalsOnly?"goals":"all"});
      const response=await fetch(`/api/game-log?${params}`,{cache:"no-store"});
      if(!response.ok){const data=await response.json() as {error?:string};throw new Error(data.error||"Download failed.");}
      const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement("a");
      link.href=url;link.download=response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1]||"NBHL-games.xlsx";document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),10000);
      setMessage(`Downloaded ${ids.length} game${ids.length===1?"":"s"}${goalsOnly?" — goals only":""}.`);
    }catch(error){setMessage(error instanceof Error?error.message:"Download failed.");}finally{setBusy(false);}
  }
  const selectedCount=games.filter(game=>selected.has(game.game_id)).length;
  return <main className="control-page"><section className="control-card excel-downloads">
    <p className="control-eyebrow">NBHL broadcast controls</p><h1>Excel downloads</h1><a className="admin-nav-link" href="/control">Back to control board</a>
    <p>Each game gets its own worksheet tab, using your A–K template.</p>
    <fieldset className="download-options"><legend>Include</legend>
      <label><input type="radio" name="event-filter" checked={!goalsOnly} onChange={()=>setGoalsOnly(false)} disabled={busy}/> Goals and periods</label>
      <label><input type="radio" name="event-filter" checked={goalsOnly} onChange={()=>setGoalsOnly(true)} disabled={busy}/> Goals only</label>
    </fieldset>
    <div className="download-actions"><button type="button" disabled={busy||loading||!selectedCount} onClick={()=>void download()}>Download selected ({selectedCount})</button><button type="button" disabled={busy||loading||!games.length} onClick={()=>void download(true)}>Download all ({games.length})</button></div>
    <div className="download-selection"><button type="button" disabled={busy||loading||!games.length} onClick={()=>setSelected(new Set(games.map(game=>game.game_id)))}>Select all</button><button type="button" disabled={busy||!selected.size} onClick={()=>setSelected(new Set())}>Clear selection</button><button type="button" disabled={busy||loading} onClick={()=>void refresh()}>Refresh games</button></div>
    {loading?<p>Loading saved games…</p>:!games.length?<p>No saved games yet. Activate a game from the control board to start its event log.</p>:<ul className="download-game-list">{games.map(game=><li key={game.game_id}><label><input type="checkbox" checked={selected.has(game.game_id)} disabled={busy} onChange={event=>setSelected(current=>{const next=new Set(current);if(event.target.checked)next.add(game.game_id);else next.delete(game.game_id);return next;})}/><span><strong>{game.matchup||`Game ${game.game_id}`}</strong><small>Game {game.game_id} · {game.goals} goal{game.goals===1?"":"s"} · Updated {new Date(game.updated_at).toLocaleString()}</small></span></label></li>)}</ul>}
    {busy&&<p role="status">Preparing Excel download…</p>}{message&&<p className="control-message" role="status">{message}</p>}
  </section></main>;
}
