"use client";
import { useEffect, useRef, useState } from "react";
const options = [["powerplay", "Power Play"], ["two-man", "Two-Man Advantage"], ["empty-net", "Empty Net"], ["timeout", "Timeout"]] as const;
type Side = "left" | "right";
type GraphicState = { left: string; right: string };
function Banner({ side, graphic, active, index, remove }: { side: Side; graphic: string; active: boolean; index: number; remove: () => void }) {
  const incoming = useRef<HTMLVideoElement>(null);
  const outgoing = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const removeRef = useRef(remove);
  removeRef.current = remove;
  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const source = active ? incoming.current : outgoing.current;
    if (!source) return;
    incoming.current?.pause();
    outgoing.current?.pause();
    source.currentTime = 0;
    const draw = () => {
      if (cancelled) return;
      const context = canvas.current?.getContext("2d");
      if (context && source.readyState >= 2) {
        context.clearRect(0, 0, 566, 40);
        context.drawImage(source, 0, 0, 566, 40);
      }
      if (source.ended) { if (!active) removeRef.current(); return; }
      frame = requestAnimationFrame(draw);
    };
    // Keep the existing canvas frame until the preloaded clip starts playing.
    const start = () => { if (!cancelled) frame = requestAnimationFrame(draw); };
    source.addEventListener("playing", start, { once: true });
    void source.play().catch(() => {});
    return () => { cancelled = true; cancelAnimationFrame(frame); source.removeEventListener("playing", start); source.pause(); };
  }, [active]);
  return <><canvas ref={canvas} width={566} height={40} className={`team-addon team-addon--${side}`} style={{ top: `calc(100% + ${index * 20}px)` }} /><video ref={incoming} style={{ display: "none" }} src={`/addons/${graphic}-${side}.webm?v=3`} muted playsInline preload="auto" /><video ref={outgoing} style={{ display: "none" }} src={`/addons/${graphic}-${side}-out.webm?v=3`} muted playsInline preload="auto" /></>;
}
export default function TeamAddons({ controls = false, leftName = "Left team", rightName = "Right team" }: { controls?: boolean; leftName?: string; rightName?: string }) {
  const [graphics, setGraphics] = useState<GraphicState>({ left: "off", right: "off" });
  const [present, setPresent] = useState<GraphicState>({ left: "off", right: "off" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let stopped = false;
    const refresh = async () => { try { const r = await fetch("/api/addons", { cache: "no-store" }); if (r.ok && !stopped) {
      const next = await r.json() as GraphicState;
      setGraphics(next);
      setPresent(old => ({ left: [...new Set([...old.left.split(","), ...next.left.split(",")])].join(","), right: [...new Set([...old.right.split(","), ...next.right.split(",")])].join(",") }));
    } } catch {} };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 500);
    return () => { stopped = true; window.clearInterval(timer); };
  }, []);
  async function change(side: Side, graphic: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/addons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ side, graphic }) });
      if (!r.ok) throw new Error();
      setGraphics(await r.json()); setMessage("");
    } catch { setMessage("Could not change graphic. Try again."); }
    finally { setBusy(false); }
  }
  if (controls) return <section className="team-addon-controls"><h2>Team graphics</h2><div>{(["left", "right"] as const).map(side => <div className="team-graphic-group" key={side} role="group" aria-label={`${side === "left" ? leftName : rightName} graphics`}><h3>{side === "left" ? leftName : rightName}</h3><div className="team-graphic-buttons">{options.map(([value, label]) => <button type="button" key={value} disabled={busy} aria-pressed={graphics[side].split(",").includes(value)} onClick={() => void change(side, value)}>{label}</button>)}</div></div>)}</div>{message && <p role="status">{message}</p>}</section>;
  return <>{(["left", "right"] as const).map(side => options.filter(([value]) => present[side].split(",").includes(value)).map(([graphic], index) => <Banner key={`${side}-${graphic}`} side={side} graphic={graphic} index={index} active={graphics[side].split(",").includes(graphic)} remove={() => setPresent(old => ({ ...old, [side]: old[side].split(",").filter(item => item !== graphic).join(",") }))} />))}</>;
}
