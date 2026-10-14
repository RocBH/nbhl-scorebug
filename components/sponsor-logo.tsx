"use client";
import { useEffect, useState } from "react";
export type Sponsor = { imageKey: string; width: number; right: number; top: number; opacity: number; visible: boolean };
export default function SponsorLogo() {
  const [settings, setSettings] = useState<Sponsor | null>(null);
  useEffect(() => {
    const refresh = async () => { try { const r = await fetch("/api/sponsor", { cache: "no-store" }); if (r.ok) setSettings(await r.json()); } catch {} };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, []);
  if (!settings?.imageKey || !settings.visible) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="Sponsor or event logo" src={`/api/sponsor?image=${encodeURIComponent(settings.imageKey)}`} style={{ position: "fixed", right: settings.right, top: settings.top, width: settings.width, height: "auto", opacity: settings.opacity / 100, pointerEvents: "none" }} />;
}
