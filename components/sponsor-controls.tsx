"use client";
import { useEffect, useState } from "react";
import type { Sponsor } from "./sponsor-logo";
const defaults: Sponsor = { imageKey: "", width: 240, right: 98, top: 75, opacity: 100, visible: true };
export default function SponsorControls() {
  const [settings, setSettings] = useState(defaults);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void fetch("/api/sponsor", { cache: "no-store" }).then(async r => { if(r.ok) setSettings(await r.json()); }); }, []);
  async function save(body: FormData | Partial<Sponsor>) {
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/sponsor", body instanceof FormData ? { method: "POST", body } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setSettings(result); setMessage("Logo settings saved.");
    } catch(error) { setMessage(error instanceof Error ? error.message : "Could not save logo."); }
    finally { setBusy(false); }
  }
  return <section className="sponsor-controls" aria-label="Sponsor or event logo">
    <h2>Sponsor / event logo</h2>
    <label className="sponsor-upload">Upload logo (PNG, JPG, WebP, GIF · max 5 MB)
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={e => { const file=e.target.files?.[0]; if(file){const data=new FormData();data.append("logo",file);void save(data);} e.target.value=""; }} />
    </label>
    {settings.imageKey && <div className="sponsor-preview">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/sponsor?image=${encodeURIComponent(settings.imageKey)}`} alt="Uploaded logo preview" style={{ maxWidth: Math.min(settings.width, 300), opacity: settings.opacity / 100 }} />
    </div>}
    <label className="clock-toggle"><input type="checkbox" checked={settings.visible} disabled={busy} onChange={e=>void save({visible:e.target.checked})}/><span>Show logo on overlay</span></label>
    <div className="sponsor-settings">
      {([["width", "Size / width", 40, 1000, "px"], ["right", "Distance from right", 0, 1920, "px"], ["top", "Distance from top", 0, 1080, "px"], ["opacity", "Opacity", 0, 100, "%"]] as const).map(([key,label,min,max,unit])=><label key={key}>{label}<input type="number" min={min} max={max} value={settings[key]} onChange={e=>setSettings({...settings,[key]:Number(e.target.value)})}/><span>{unit}</span></label>)}
    </div>
    <p>Position is measured from the top-right corner. Logo proportions are preserved.</p>
    <button type="button" disabled={busy} onClick={()=>void save(settings)}>{busy ? "Saving…" : "Apply logo settings"}</button>
    {message && <p role="status">{message}</p>}
  </section>;
}
