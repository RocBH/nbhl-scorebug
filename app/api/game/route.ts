import { decodeSingleQuotedJavaScript } from "@/lib/nbhl-source";
import { recordGameEvents } from "@/lib/game-event-log";
import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { scorebugSettings, gameOverrides } from "@/db/schema";
import { formatClockSeconds, remainingClockSeconds } from "@/lib/manual-clock";

export const dynamic = "force-dynamic";

type RawTeam = { id: number; name?: string; fullName?: string; abbreviation?: string; avatar?: string };
type RawGame = {
  id: number;
  startTime?: string;
  sportCenterName?: string;
  sportCenterAbr?: string;
  date?: string;
  time?: string;
  periodId?: number;
  statusId?: number;
  final?: boolean;
  localTeamId: number;
  localTeamName?: string;
  localTeamAvatar?: string;
  localResult?: number;
  visitorTeamId: number;
  visitorTeamName?: string;
  visitorTeamAvatar?: string;
  visitorResult?: number;
  teamList?: RawTeam[];
};


function cleanClock(value?: string) {
  if (!value) return "";
  const parts = value.split(":");
  return parts.length === 3 ? `${parts[1]}:${parts[2]}` : value;
}

function absoluteImageUrl(value?: string) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return new URL(value, "https://thenbhl.com").toString();
}

function normalizeGame(game: RawGame) {
  const teams = game.teamList || [];
  const visitor = teams.find((team) => team.id === game.visitorTeamId);
  const home = teams.find((team) => team.id === game.localTeamId);
  const status = game.final || game.statusId === 3 ? "final" : game.statusId === 2 ? "live" : "scheduled";
  return {
    id: game.id,
    status,
    showClock: true,
    startTime: game.startTime || "",
    rinkName: game.sportCenterName || game.sportCenterAbr || "",
    scheduledStart: game.date && game.startTime ? `${game.date.slice(0, 10)}T${game.startTime}` : "",
    period: game.periodId || 0,
    clock: cleanClock(game.time),
    visitor: {
      id: game.visitorTeamId,
      name: visitor?.name || visitor?.fullName || game.visitorTeamName || "Visitor",
      abbreviation: visitor?.abbreviation || "",
      logo: absoluteImageUrl(visitor?.avatar || game.visitorTeamAvatar),
      score: Number(game.visitorResult || 0),
    },
    home: {
      id: game.localTeamId,
      name: home?.name || home?.fullName || game.localTeamName || "Home",
      abbreviation: home?.abbreviation || "",
      logo: absoluteImageUrl(home?.avatar || game.localTeamAvatar),
      score: Number(game.localResult || 0),
    },
  };
}

export async function GET(request: Request) {
  try {
    const requestedId = new URL(request.url).searchParams.get("id");
    if (requestedId && !/^\d{1,10}$/.test(requestedId)) {
      return NextResponse.json({ error: "Invalid NBHL game number." }, { status: 400 });
    }
    let [settings] = await getDb()
      .select()
      .from(scorebugSettings)
      .where(eq(scorebugSettings.id, 1))
      .limit(1);
    if (!requestedId && settings && settings.activeStartedAt == null) {
      await getDb().update(scorebugSettings).set({ activeStartedAt: Date.now() }).where(and(eq(scorebugSettings.id, 1), isNull(scorebugSettings.activeStartedAt)));
      [settings] = await getDb().select().from(scorebugSettings).where(eq(scorebugSettings.id, 1)).limit(1);
    }
    const id = requestedId || settings?.gameId || "756210";
    const response = await fetch(`https://thenbhl.com/scores/game-${id}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "text/html", "User-Agent": "NBHL-OBS-Scorebug/1.0" },
    });
    if (!response.ok) throw new Error(`NBHL returned ${response.status}`);
    const html = await response.text();
    const match = html.match(/var\s+__gameDetails__\s*=\s*'((?:\\.|[^'\\])*)';/);
    if (!match) return NextResponse.json({ error: "NBHL game not found." }, { status: 404 });
    const game = JSON.parse(decodeSingleQuotedJavaScript(match[1])) as RawGame;
    const normalized = normalizeGame(game);
    const [override] = await getDb().select().from(gameOverrides).where(eq(gameOverrides.gameId, id)).limit(1);
    if (override?.visitorScore != null) normalized.visitor.score = override.visitorScore;
    if (override?.homeScore != null) normalized.home.score = override.homeScore;
    if (override?.period != null) {
      normalized.period = override.period;
      normalized.status = override.period === 99 ? "final" : "live";
    }
    let eventLogAvailable: boolean | undefined;
    if (!requestedId && settings?.activeStartedAt) {
      try { await recordGameEvents(game, settings.activeStartedAt, normalized.status === "final" ? 99 : normalized.period || 1); eventLogAvailable = true; }
      catch (error) { eventLogAvailable = false; console.error("Game event log unavailable", error); }
    }
    if (!requestedId && settings) {
      const queue = JSON.parse(settings.gameQueue || "[]") as string[];
      const nextIndex = settings.queueIndex + 1;
      const selectedGame = and(eq(scorebugSettings.id, 1), eq(scorebugSettings.gameId, id), eq(scorebugSettings.queueIndex, settings.queueIndex), eq(scorebugSettings.autoAdvance, true));
      if (settings.autoAdvance && normalized.status === "final" && queue[nextIndex]) {
        if (settings.autoAdvanceEndsAt == null) {
          await getDb().update(scorebugSettings).set({ autoAdvanceEndsAt: Date.now() + 120_000, updatedAt: new Date() }).where(and(selectedGame, isNull(scorebugSettings.autoAdvanceEndsAt)));
        } else if (Date.now() >= settings.autoAdvanceEndsAt) {
          await getDb().update(scorebugSettings).set({ gameId: queue[nextIndex], queueIndex: nextIndex, activeStartedAt: Date.now(), autoAdvanceEndsAt: null, manualClockRunning: false, manualClockRemainingSeconds: 600, manualClockEndsAt: null, updatedAt: new Date() }).where(and(selectedGame, eq(scorebugSettings.autoAdvanceEndsAt, settings.autoAdvanceEndsAt)));
          const [latest] = await getDb().select().from(scorebugSettings).where(eq(scorebugSettings.id, 1));
          if (latest && latest.gameId !== id) {
            const nextUrl = new URL(request.url);
            nextUrl.searchParams.set("id", latest.gameId);
            return GET(new Request(nextUrl));
          }
        }
      } else if (settings.autoAdvanceEndsAt != null) {
        await getDb().update(scorebugSettings).set({ autoAdvanceEndsAt: null }).where(and(eq(scorebugSettings.id, 1), eq(scorebugSettings.gameId, id), eq(scorebugSettings.autoAdvanceEndsAt, settings.autoAdvanceEndsAt)));
      }
    }
    const manualClockEnabled = settings?.manualClockEnabled ?? false;
    const manualClockRemainingSeconds = remainingClockSeconds(settings || {});
    const manualClockRunning = Boolean(settings?.manualClockRunning && settings?.manualClockEndsAt && manualClockRemainingSeconds > 0);
    return NextResponse.json(
      {
        ...normalized,
        eventLogAvailable,
        overrides: { visitorScore: override?.visitorScore ?? null, homeScore: override?.homeScore ?? null, period: override?.period ?? null },
        clock: manualClockEnabled ? formatClockSeconds(manualClockRemainingSeconds) : normalized.clock,
        showClock: settings?.showClock ?? true,
        manualClockEnabled,
        manualClockRunning,
        manualClockRemainingSeconds,
        manualClockEndsAt: manualClockRunning ? settings?.manualClockEndsAt : null,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("Unable to load NBHL game", error);
    return NextResponse.json({ error: "NBHL score feed is temporarily unavailable." }, { status: 502 });
  }
}
