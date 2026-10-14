"use client";

import { FormEvent, useEffect, useState } from "react";
import { ScorebugFace, type Game } from "@/components/scorebug";
import SponsorControls from "@/components/sponsor-controls";
import TeamAddons from "@/components/team-addons";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatClockSeconds, remainingClockSeconds } from "@/lib/manual-clock";

type QueueSettings = {
  gameId: string;
  showClock: boolean;
  autoAdvance: boolean;
  autoAdvanceEndsAt: number | null;
  activeStartedAt: number | null;
  gameQueue: string[];
  queueIndex: number;
  manualClockEnabled: boolean;
  manualClockRunning: boolean;
  manualClockRemainingSeconds: number;
  manualClockEndsAt: number | null;
};

function formatElapsed(seconds: number) { return `${Math.floor(seconds / 3600).toString().padStart(2,"0")}:${Math.floor(seconds % 3600 / 60).toString().padStart(2,"0")}:${(seconds % 60).toString().padStart(2,"0")}`; }

type ActionResponse = Partial<QueueSettings> & { gameId?: string; error?: string };

export default function ControlPanel({ displayName, isAdmin = false }: { displayName: string; isAdmin?: boolean }) {
  const [queueInput, setQueueInput] = useState("");
  const [queue, setQueue] = useState<string[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [active, setActive] = useState<Game | null>(null);
  const [previews, setPreviews] = useState<Record<string, Game>>({});
  const [previewErrors, setPreviewErrors] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showClock, setShowClock] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [activeStartedAt, setActiveStartedAt] = useState<number | null>(null);
  const [autoAdvanceEndsAt, setAutoAdvanceEndsAt] = useState<number | null>(null);
  const [manualClockEnabled, setManualClockEnabled] = useState(false);
  const [manualClockRunning, setManualClockRunning] = useState(false);
  const [manualClockRemainingSeconds, setManualClockRemainingSeconds] = useState(600);
  const [manualClockEndsAt, setManualClockEndsAt] = useState<number | null>(null);
  const [clockInput, setClockInput] = useState("");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [scheduleNow, setScheduleNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setScheduleNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function applyClockState(settings: Partial<QueueSettings>) {
    if (settings.manualClockEnabled !== undefined) setManualClockEnabled(settings.manualClockEnabled);
    if (settings.manualClockRunning !== undefined) setManualClockRunning(settings.manualClockRunning);
    if (settings.manualClockRemainingSeconds !== undefined) setManualClockRemainingSeconds(settings.manualClockRemainingSeconds);
    if (settings.manualClockEndsAt !== undefined) setManualClockEndsAt(settings.manualClockEndsAt);
    setClockNow(Date.now());
  }

  async function loadPreviews(games: string[]) {
    setPreviews({});
    setPreviewErrors({});
    await Promise.all(games.map(async (id) => {
      try {
        const response = await fetch(`/api/game?id=${encodeURIComponent(id)}&t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Preview unavailable");
        const game = (await response.json()) as Game;
        setPreviews((current) => ({ ...current, [id]: game }));
      } catch {
        setPreviewErrors((current) => ({ ...current, [id]: true }));
      }
    }));
  }

  async function loadControls(syncInput = true, refreshPreviews = true) {
    const gameResponse = await fetch(`/api/game?t=${Date.now()}`, { cache: "no-store" });
    const settingsResponse = await fetch(`/api/settings?t=${Date.now()}`, { cache: "no-store" });
    if (gameResponse.ok) setActive((await gameResponse.json()) as Game);
    if (settingsResponse.ok) {
      const settings = (await settingsResponse.json()) as QueueSettings;
      setQueue(settings.gameQueue);
      setQueueIndex(settings.queueIndex);
      setShowClock(settings.showClock);
      setAutoAdvance(settings.autoAdvance);
      setAutoAdvanceEndsAt(settings.autoAdvanceEndsAt);
      setActiveStartedAt(settings.activeStartedAt);
      applyClockState(settings);
      if (syncInput) setQueueInput(settings.gameQueue.map((id) => `https://thenbhl.com/scores/game-${id}`).join("\n"));
      if (refreshPreviews) void loadPreviews(settings.gameQueue);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadControls(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void loadControls(false, false), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!manualClockRunning || !manualClockEndsAt) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [manualClockEndsAt, manualClockRunning]);

  async function sendAction(body: object) {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as ActionResponse;
    if (!response.ok) throw new Error(payload.error || "Update failed");
    return payload;
  }

  async function setGameOverride(field?: "visitorScore" | "homeScore" | "period", value?: number | null, reset = false) {
    if (!active || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/overrides", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId: String(active.id), field, value, reset }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Update failed");
      await loadControls(false, false);
      setMessage(reset ? "Scores and period restored to NBHL website values." : "Manual update is on air.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed"); }
    finally { setSaving(false); }
  }

  async function loadQueue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const games = queueInput.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
      const payload = await sendAction({ action: "loadQueue", games, showClock });
      setMessage(`${games.length} game${games.length === 1 ? "" : "s"} loaded. Game ${payload.gameId} is now on air.`);
      await loadControls();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function switchGame(index: number) {
    if (saving || index === queueIndex || index < 0 || index >= queue.length) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = await sendAction({ action: "select", queueIndex: index });
      setQueueIndex(index);
      setMessage(`Game ${payload.gameId} is now on air.`);
      await loadControls(false, false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function updateClock(checked: boolean) {
    setShowClock(checked);
    setMessage("");
    try {
      await sendAction({ action: "updateClock", showClock: checked });
      if (checked && !manualClockEnabled) {
        applyClockState(await sendAction({ action: "setManualClock", enabled: true }));
      }
      setMessage(checked ? "Game clock enabled." : "Game clock hidden.");
      setActive((current) => current ? { ...current, showClock: checked } : current);
    } catch (error) {
      setShowClock(!checked);
      setMessage(error instanceof Error ? error.message : "Update failed");
    }
  }

  async function setClockMode(enabled: boolean) {
    setSaving(true);
    setMessage("");
    try {
      const payload = await sendAction({ action: "setManualClock", enabled });
      applyClockState(payload);
      setMessage(enabled ? "Manual clock selected. Press Start when the period begins." : "The NBHL website clock is back on air.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Clock update failed");
    } finally {
      setSaving(false);
    }
  }

  async function editClock(delta?: number) {
    if (saving) return;
    const match = clockInput.trim().match(/^(\d{1,2}):([0-5]\d)$/);
    if (delta === undefined && !match) { setMessage("Enter time as M:SS or MM:SS, such as 8:30."); return; }
    setSaving(true);
    try {
      const payload = await sendAction(delta === undefined ? { action: "clockSet", seconds: Number(match![1]) * 60 + Number(match![2]) } : { action: "clockAdjust", delta });
      applyClockState(payload);
      if (delta === undefined) setClockInput("");
      setMessage("Manual clock updated.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Clock update failed."); }
    finally { setSaving(false); }
  }

  async function runClockAction(action: "clockStart" | "clockPause" | "clockReset") {
    setSaving(true);
    setMessage("");
    try {
      const payload = await sendAction({ action });
      applyClockState(payload);
      setMessage(action === "clockStart" ? "Manual clock started." : action === "clockPause" ? "Manual clock paused." : "Manual clock reset to 10:00.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Clock update failed");
    } finally {
      setSaving(false);
    }
  }

  const hasPrevious = queueIndex > 0;
  const hasNext = queue.length > 0 && queueIndex < queue.length - 1;
  const nextGame = hasNext ? previews[queue[queueIndex + 1]] : null;
  const nextStart = nextGame?.scheduledStart ? new Date(nextGame.scheduledStart).getTime() : NaN;
  const secondsToNext = Math.max(0, Math.ceil((nextStart - scheduleNow) / 1000));
  const nextCountdown = Number.isFinite(nextStart) ? `${Math.floor(secondsToNext / 3600).toString().padStart(2, "0")}:${Math.floor(secondsToNext % 3600 / 60).toString().padStart(2, "0")}:${(secondsToNext % 60).toString().padStart(2, "0")}` : "—";
  const clockDisplay = formatClockSeconds(remainingClockSeconds({
    manualClockRunning,
    manualClockRemainingSeconds,
    manualClockEndsAt,
  }, clockNow));

  return (
    <main className="control-page">
      <section className="control-card">
        <p className="control-eyebrow">NBHL broadcast controls</p>
        <h1>Scorebug control room</h1>
        <a className="admin-nav-link" href="/downloads">Excel downloads</a> 
        {isAdmin && <a className="admin-nav-link" href="/admin">Manage users</a>}
        <p className="control-intro">Load the day’s games, preview every scorebug, and choose which one is sent to the permanent OBS overlay.</p>

        <Tabs defaultValue="live" className="control-tabs">
          <TabsList className="control-tab-list" aria-label="Control room sections">
            <TabsTrigger value="live">Live controls</TabsTrigger>
            <TabsTrigger value="setup">Setup</TabsTrigger>
          </TabsList>
          <TabsContent value="live">
        <div className="current-game-preview">
          <p>Current game preview</p>
          <div className="scorebug-preview-shell">
            {active ? <div className="scorebug-preview-stage"><ScorebugFace showAddons game={{
              ...active,
              showClock,
              manualClockEnabled,
              clock: manualClockEnabled ? clockDisplay : active.clock,
            }} /></div> : <div className="preview-state">Loading current game…</div>}
          </div>
        </div>
        <section className={`manual-clock-control ${manualClockEnabled ? "manual-clock-control--active" : ""}`} aria-label="Manual game clock">
          <header>
            <div><span>Game clock</span><strong>{manualClockEnabled ? "Manual clock on air" : "Using NBHL website clock"}</strong></div>
            <label className="manual-clock-toggle">
              <input type="checkbox" checked={manualClockEnabled} onChange={(event) => void setClockMode(event.target.checked)} disabled={saving} />
              <span>Manual</span>
            </label>
          </header>
          <label className="clock-toggle">
            <input type="checkbox" checked={showClock} disabled={saving} onChange={(event) => void updateClock(event.target.checked)} />
            <span>Show game clock on scorebug</span>
          </label>
          <div className="manual-clock-readout" aria-live="off">{clockDisplay}</div>
          <form className="manual-clock-edit" onSubmit={event => { event.preventDefault(); void editClock(); }}>
            <label htmlFor="manual-clock-time">Set time (MM:SS)</label>
            <div><input id="manual-clock-time" type="text" inputMode="text" value={clockInput} placeholder={clockDisplay} onChange={event => setClockInput(event.target.value)} disabled={saving} maxLength={5} /><button type="submit" disabled={saving || !clockInput.trim()}>Set time</button></div>
          </form>
          <div className="clock-second-buttons">
            <button type="button" disabled={saving} onClick={() => void editClock(-1)} aria-label="Subtract one second">−1 sec</button>
            <button type="button" disabled={saving} onClick={() => void editClock(1)} aria-label="Add one second">+1 sec</button>
          </div>
          <div className="manual-clock-buttons">
            <button type="button" className={manualClockRunning ? "clock-pause" : "clock-start"} onClick={() => void runClockAction(manualClockRunning ? "clockPause" : "clockStart")} disabled={saving}>
              {manualClockRunning ? "Pause" : "Start"}
            </button>
            <button type="button" className="clock-reset" onClick={() => void runClockAction("clockReset")} disabled={saving}>Reset to 10:00</button>
          </div>
          <p>{manualClockEnabled ? "This clock keeps running even if you close the control panel." : "Start or reset the clock to switch the overlay to manual time."}</p>
        </section>

        <TeamAddons controls leftName={active?.visitor.name} rightName={active?.home.name} />

        <div className="active-game">
          <span>On air now</span>
          {active ? <strong>{active.visitor.name} {active.visitor.score}–{active.home.score} {active.home.name}</strong> : <strong>Loading active game…</strong>}
          <div className="game-navigation">
            <button type="button" onClick={() => void switchGame(queueIndex - 1)} disabled={!hasPrevious || saving}>Previous game</button>
            <button type="button" onClick={() => void switchGame(queueIndex + 1)} disabled={!hasNext || saving}>Next game</button>
          </div>
          <label className="clock-toggle">
            <input type="checkbox" checked={autoAdvance} disabled={saving} onChange={async event => {
              const enabled = event.target.checked;
              setSaving(true);
              try { await sendAction({ action: "setAutoAdvance", enabled }); setAutoAdvance(enabled); setAutoAdvanceEndsAt(null); setMessage(enabled ? "Automatic game advance enabled." : "Automatic game advance disabled."); }
              catch { setMessage("Could not save automatic advance. Try again."); }
              finally { setSaving(false); }
            }} />
            <span>Automatically advance 2 minutes after a game finishes</span>
          </label>
        </div>

        <details className="game-log-controls">
          <summary>Game event log</summary>
          <div>
            <strong>Elapsed since game activated: {formatElapsed(activeStartedAt ? Math.max(0, Math.floor((scheduleNow - activeStartedAt) / 1000)) : 0)}</strong>
            <p>Logs goals, goal updates, and period changes as they arrive. Keep the control board or OBS overlay open to capture updates. Existing goals have no arrival timestamp.</p>
            {active?.eventLogAvailable === false && <p role="alert">Event logging is temporarily unavailable. Keep this page open while it retries.</p>}
            {active && <a className="game-log-download" href={`/downloads?game=${active.id}`}>Open Excel downloads</a>}
          </div>
        </details>

        <details className="manual-score-controls">
          <summary>Manual score &amp; period</summary>
          <div className="manual-score-content">
            {active ? <>
              <div className="manual-score-teams">
                {(["visitor", "home"] as const).map(side => {
                  const field = side === "visitor" ? "visitorScore" : "homeScore";
                  return <div className="manual-team-score" key={side}>
                    <strong>{active[side].name}</strong>
                    <div className="manual-score-stepper">
                      <button type="button" aria-label={`Subtract goal from ${active[side].name}`} disabled={saving || active[side].score <= 0} onClick={() => void setGameOverride(field, active[side].score - 1)}>−</button>
                      <output>{active[side].score}</output>
                      <button type="button" aria-label={`Add goal to ${active[side].name}`} disabled={saving || active[side].score >= 99} onClick={() => void setGameOverride(field, active[side].score + 1)}>+</button>
                    </div>
                    <small>{active.overrides?.[field] != null ? "Manual score" : "NBHL website score"}</small>
                    {active.overrides?.[field] != null && <button type="button" disabled={saving} onClick={() => void setGameOverride(field, null)}>Use website score</button>}
                  </div>;
                })}
              </div>
              <strong>Period</strong>
              <div className="manual-period-buttons">
                {([[1, "1st"], [2, "2nd"], [3, "3rd"], [4, "OT"], [9, "S/O"], [99, "Final"]] as const).map(([value, label]) => <button type="button" key={value} disabled={saving} aria-pressed={active.status === "final" ? value === 99 : active.period === value || (value === 1 && active.status === "scheduled")} onClick={() => void setGameOverride("period", value)}>{label}</button>)}
              </div>
              <small>{active.overrides?.period != null ? "Manual period" : "NBHL website period"}. Final starts the 2-minute hold when automatic advance is enabled.</small>
              <div className="manual-reset-buttons">
                <button type="button" disabled={saving || active.overrides?.period == null} onClick={() => void setGameOverride("period", null)}>Use website period</button>
                <button type="button" disabled={saving} onClick={() => void setGameOverride(undefined, undefined, true)}>Restore all website values</button>
              </div>
            </> : <p>Load a game to use manual controls.</p>}
          </div>
        </details>

        <section className="next-game-countdown" aria-label="Next game countdown">
          <span>{autoAdvance && autoAdvanceEndsAt ? "Next game goes on air in" : "Next game starts in"}</span>
          <strong className="next-game-countdown-time">{hasNext ? autoAdvance && autoAdvanceEndsAt ? formatClockSeconds(Math.max(0, Math.ceil((autoAdvanceEndsAt - scheduleNow) / 1000))) : nextCountdown : "No next game"}</strong>
          <p>{nextGame ? `${nextGame.visitor.name} vs. ${nextGame.home.name}` : hasNext ? "Loading next game…" : "Load more games in Setup."}</p>
          {nextGame && <small>{nextGame.status === "live" ? "Already live" : nextGame.status === "final" ? "Already finished" : Number.isFinite(nextStart) ? secondsToNext === 0 ? "Scheduled start time reached" : `Scheduled: ${new Date(nextStart).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "No scheduled start available"} · Control board only</small>}
        </section>


        {queue.length > 0 && (
          <section className="queue-list" aria-label="Loaded game scorebugs">
            <header>
              <div><span>Loaded scorebugs</span><small>Select any preview to put it on air</small></div>
              <strong>{queueIndex + 1} of {queue.length}</strong>
            </header>
            <ol>
              {queue.map((id, index) => {
                const preview = previews[id];
                const onAir = index === queueIndex;
                return (
                  <li key={`${id}-${index}`} className={onAir ? "queue-current" : ""}>
                    <button className="queue-game-button" type="button" aria-pressed={onAir} onClick={() => void switchGame(index)} disabled={saving}>
                      <span className="queue-game-heading">
                        <span className="queue-order">{index + 1}</span>
                        <span className="queue-game-name">
                          <strong>{preview ? `${preview.visitor.name} vs. ${preview.home.name}` : `Game ${id}`}</strong>
                          <small>Game {id}</small>
                        </span>
                        <em>{onAir ? "On air" : "Put on air"}</em>
                      </span>
                      <span className="scorebug-preview-shell">
                        {preview ? (
                          <span className="scorebug-preview-stage"><ScorebugFace game={{
                            ...preview,
                            showClock,
                            clock: manualClockEnabled ? clockDisplay : preview.clock,
                            manualClockEnabled,
                            manualClockRunning,
                            manualClockRemainingSeconds,
                            manualClockEndsAt,
                          }} /></span>
                        ) : previewErrors[id] ? (
                          <span className="preview-state preview-state--error">Preview unavailable</span>
                        ) : (
                          <span className="preview-state"><span className="spinner" /> Loading preview</span>
                        )}
                      </span>
                    </button>
                    <a className="queue-log-download" href={`/downloads?game=${id}`}>Excel downloads</a>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

          </TabsContent>
          <TabsContent value="setup">
            <form onSubmit={loadQueue}>
              <label htmlFor="games">Game URLs or numbers — one per line</label>
              <textarea id="games" value={queueInput} onChange={(event) => setQueueInput(event.target.value)} placeholder={"https://thenbhl.com/scores/game-756210\nhttps://thenbhl.com/scores/game-756211"} rows={6} />
              <button type="submit" disabled={saving}>{saving ? "Updating…" : "Load game queue"}</button>
            </form>
            <SponsorControls />
          </TabsContent>
        </Tabs>
        {message && <p className="control-message" role="status">{message}</p>}
        <footer>Signed in as {displayName}</footer>
      </section>
    </main>
  );
}
