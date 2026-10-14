"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import SponsorLogo from "@/components/sponsor-logo";
import TeamAddons from "@/components/team-addons";
import { formatClockSeconds, remainingClockSeconds } from "@/lib/manual-clock";

export type Team = { id: number; name: string; abbreviation: string; logo: string; score: number };
export type Game = {
  id: number;
  status: "live" | "final" | "scheduled";
  period: number;
  eventLogAvailable?: boolean;
  overrides?: { visitorScore: number | null; homeScore: number | null; period: number | null };
  clock: string;
  startTime: string;
  rinkName?: string;
  scheduledStart?: string;
  showClock: boolean;
  manualClockEnabled?: boolean;
  manualClockRunning?: boolean;
  manualClockRemainingSeconds?: number;
  manualClockEndsAt?: number | null;
  visitor: Team;
  home: Team;
};
function teamCode(team: Team) {
  if (team.abbreviation) return team.abbreviation.slice(0, 4).toUpperCase();
  const words = team.name.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((word) => word[0]).join("").slice(0, 4).toUpperCase();
  return (words[0] || "TEAM").slice(0, 4).toUpperCase();
}

function periodLabel(period: number) {
  if (period <= 0) return "Pre-game";
  if (period === 1) return "1st";
  if (period === 2) return "2nd";
  if (period === 3) return "3rd";
  if (period === 9) return "S/O";
  return "OT";
}

function gamePeriod(game: Game) {
  if (game.status === "final") return "Final";
  if (game.status === "scheduled") return "1st";
  return periodLabel(game.period);
}

function gameClock(game: Game) {
  if (game.manualClockEnabled) return game.clock || "10:00";
  if (game.status === "final") return "Final";
  if (game.status === "scheduled") return game.startTime || "Soon";
  return game.clock || "Live";
}

function proxiedLogo(url: string) {
  return `/api/logo?url=${encodeURIComponent(url)}`;
}

function dominantTeamColor(image: HTMLImageElement) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 36;
    canvas.height = 36;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, 36, 36);
    const pixels = context.getImageData(0, 0, 36, 36).data;
    const bins = new Map<number, { score: number; hue: number; count: number }>();

    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index + 3] < 150) continue;
      const red = pixels[index] / 255;
      const green = pixels[index + 1] / 255;
      const blue = pixels[index + 2] / 255;
      const max = Math.max(red, green, blue);
      const min = Math.min(red, green, blue);
      const delta = max - min;
      const lightness = (max + min) / 2;
      const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
      if (saturation < 0.28 || lightness < 0.12 || lightness > 0.9) continue;
      let hue = 0;
      if (max === red) hue = 60 * (((green - blue) / delta) % 6);
      else if (max === green) hue = 60 * ((blue - red) / delta + 2);
      else hue = 60 * ((red - green) / delta + 4);
      if (hue < 0) hue += 360;
      const bucket = Math.round(hue / 24) * 24;
      const entry = bins.get(bucket) || { score: 0, hue: 0, count: 0 };
      entry.score += saturation * (1 - Math.abs(lightness - 0.5));
      entry.hue += hue;
      entry.count += 1;
      bins.set(bucket, entry);
    }

    const winner = [...bins.values()].sort((a, b) => b.score - a.score)[0];
    if (!winner) return null;
    return `hsl(${Math.round(winner.hue / winner.count)} 68% 39%)`;
  } catch {
    return null;
  }
}

function TeamLogo({ team, onColor }: { team: Team; onColor?: (color: string) => void }) {
  return (
    <span className="team-logo">
      {team.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxiedLogo(team.logo)}
          alt=""
          onLoad={(event) => {
            const color = dominantTeamColor(event.currentTarget);
            if (color) onColor?.(color);
          }}
        />
      ) : (
        <span className="team-monogram">{teamCode(team).slice(0, 2)}</span>
      )}
    </span>
  );
}

function TeamPanel({ team, side, scored }: { team: Team; side: "visitor" | "home"; scored: boolean }) {
  const [color, setColor] = useState("#aeb1b4");
  return (
    <div
      className={`team-panel team-panel--${side} ${scored ? "score-side--scored" : ""}`}
      style={{ "--team-color": color } as CSSProperties}
    >
      <TeamLogo team={team} onColor={setColor} />
    </div>
  );
}

export function ScorebugFace({ game, flashTeam = null, showAddons = false }: { game: Game; flashTeam?: "visitor" | "home" | null; showAddons?: boolean }) {
  return (
    <section className={`scorebug ${flashTeam ? "scorebug--flash" : ""}`} aria-label={`${game.visitor.name} ${game.visitor.score}, ${game.home.name} ${game.home.score}`}>
      <TeamPanel team={game.visitor} side="visitor" scored={flashTeam === "visitor"} />
      <strong className={`score-box score-box--visitor ${flashTeam === "visitor" ? "score-side--scored" : ""}`}>{game.visitor.score}</strong>
      <div className={`status-shield ${!game.showClock ? "status-shield--solo" : ""}`}>
        <div className="shield-face">
          {game.showClock ? (
            <><span className="shield-clock">{gameClock(game)}</span><span className="shield-period">{gamePeriod(game)}</span></>
          ) : (
            <span className="shield-period shield-period--solo">{gamePeriod(game)}</span>
          )}
        </div>
      </div>
      <strong className={`score-box score-box--home ${flashTeam === "home" ? "score-side--scored" : ""}`}>{game.home.score}</strong>
      <TeamPanel team={game.home} side="home" scored={flashTeam === "home"} />
      {flashTeam && <div className="goal-banner">Goal</div>}
      {showAddons && <TeamAddons />}
    </section>
  );
}

export default function Scorebug() {
  const [game, setGame] = useState<Game | null>(null);
  const [warning, setWarning] = useState("");
  const flashTeam = null;
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [clockState, setClockState] = useState<Pick<Game, "showClock" | "manualClockEnabled" | "manualClockRunning" | "manualClockRemainingSeconds" | "manualClockEndsAt"> | null>(null);
  const scoreRef = useRef<{ visitor: number; home: number } | null>(null);
  const flashTimer = useRef<number | null>(null);

  const fetchGame = useCallback(async () => {
    try {
      const response = await fetch(`/api/game?t=${Date.now()}`, { cache: "no-store" });
      const payload = (await response.json()) as Game & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Score feed unavailable");

      scoreRef.current = { visitor: payload.visitor.score, home: payload.home.score };
      setGame(payload);
      setWarning("");
    } catch {
      setWarning("Score feed reconnecting");
    }
  }, []);

  useEffect(() => {
    scoreRef.current = null;
    const initialFetch = window.setTimeout(() => void fetchGame(), 0);
    const poller = window.setInterval(() => void fetchGame(), 5_000);
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(poller);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, [fetchGame]);

  useEffect(() => {
    let stopped = false;
    let timer: number;
    async function refreshClock() {
      try {
        const response = await fetch(`/api/clock?t=${Date.now()}`, { cache: "no-store" });
        if (response.ok && !stopped) {
          const state = await response.json();
          if (!stopped) { setClockState(state); setClockNow(Date.now()); }
        }
      } catch {}
      if (!stopped) timer = window.setTimeout(() => void refreshClock(), 250);
    }
    void refreshClock();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, []);

  const clockGame = game ? { ...game, ...clockState } : null;
  useEffect(() => {
    if (!clockGame?.manualClockEnabled || !clockGame.manualClockRunning || !clockGame.manualClockEndsAt) return;
    const tick = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, [clockGame?.manualClockEnabled, clockGame?.manualClockEndsAt, clockGame?.manualClockRunning]);

  const displayGame = clockGame?.manualClockEnabled ? {
    ...clockGame,
    clock: formatClockSeconds(remainingClockSeconds(clockGame, clockNow)),
  } : clockGame;

  return (
    <main className="overlay-canvas" aria-live="polite">
      <SponsorLogo />
      <div className="bug-position bug-position--tl">
        {!displayGame ? (
          <div className="loading-bug"><span className="spinner" /><span>{warning || "Connecting to NBHL"}</span></div>
        ) : (
          <>
            <ScorebugFace game={displayGame} flashTeam={flashTeam} showAddons />
            {warning && <div className="feed-warning">{warning}</div>}
          </>
        )}
      </div>
    </main>
  );
}
