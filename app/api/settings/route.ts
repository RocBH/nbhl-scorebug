import { recordClockStart } from "@/lib/game-event-log";
import { getControlUser } from "@/lib/control-access";
import { getDb } from "@/db";
import { scorebugSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { remainingClockSeconds, adjustManualClock, type ManualClockFields } from "@/lib/manual-clock";

function gameIdFrom(value: string) {
  const trimmed = value.trim();
  const fromUrl = trimmed.match(/game-(\d{1,10})/i)?.[1];
  if (fromUrl) return fromUrl;
  return /^\d{1,10}$/.test(trimmed) ? trimmed : null;
}

function readQueue(value?: string) {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function requireUser() {
  return Boolean(await getControlUser());
}

function clockPayload(settings: ManualClockFields & { manualClockEnabled?: boolean | null }, now = Date.now()) {
  const manualClockRemainingSeconds = remainingClockSeconds(settings, now);
  const manualClockRunning = Boolean(settings.manualClockRunning && settings.manualClockEndsAt && manualClockRemainingSeconds > 0);
  return {
    manualClockEnabled: settings.manualClockEnabled ?? false,
    manualClockRunning,
    manualClockRemainingSeconds,
    manualClockEndsAt: manualClockRunning ? settings.manualClockEndsAt : null,
  };
}

export async function GET() {
  if (!(await requireUser())) return Response.json({ error: "Control board access required." }, { status: 403 });
  const [settings] = await getDb().select().from(scorebugSettings).where(eq(scorebugSettings.id, 1)).limit(1);
  return Response.json({
    gameId: settings?.gameId || "756210",
    showClock: settings?.showClock ?? true,
    autoAdvance: settings?.autoAdvance ?? false,
    autoAdvanceEndsAt: settings?.autoAdvanceEndsAt ?? null,
    activeStartedAt: settings?.activeStartedAt ?? null,
    gameQueue: readQueue(settings?.gameQueue),
    queueIndex: settings?.queueIndex || 0,
    ...clockPayload(settings || {}),
  });
}

export async function POST(request: Request) {
  if (!(await requireUser())) return Response.json({ error: "Control board access required." }, { status: 403 });

  try {
    const payload = (await request.json()) as {
      action?: "loadQueue" | "next" | "select" | "updateClock" | "setManualClock" | "clockStart" | "clockPause" | "clockReset" | "clockSet" | "clockAdjust" | "setAutoAdvance";
      seconds?: number;
      delta?: number;
      games?: string[];
      queueIndex?: number;
      showClock?: boolean;
      enabled?: boolean;
    };
    const db = getDb();
    const [current] = await db.select().from(scorebugSettings).where(eq(scorebugSettings.id, 1)).limit(1);
    const now = new Date();
    if (payload.action === "setAutoAdvance") {
      const autoAdvance = payload.enabled === true;
      await db.insert(scorebugSettings).values({ id: 1, gameId: current?.gameId || "756210", autoAdvance, updatedAt: now }).onConflictDoUpdate({ target: scorebugSettings.id, set: { autoAdvance, autoAdvanceEndsAt: null, updatedAt: now } });
      return Response.json({ autoAdvance, autoAdvanceEndsAt: null });
    }
    const baseSettings = {
      id: 1,
      gameId: current?.gameId || "756210",
      showClock: current?.showClock ?? true,
      gameQueue: current?.gameQueue || "[]",
      queueIndex: current?.queueIndex || 0,
      updatedAt: now,
    };

    if (payload.action === "loadQueue") {
      const parsed = (payload.games || []).map(gameIdFrom).filter((id): id is string => Boolean(id));
      const queue = [...new Set(parsed)].slice(0, 50);
      if (!queue.length) return Response.json({ error: "Paste at least one valid NBHL game URL or game number." }, { status: 400 });
      if (parsed.length !== (payload.games || []).length) {
        return Response.json({ error: "One or more entries are not valid NBHL game URLs or numbers." }, { status: 400 });
      }
      const showClock = payload.showClock ?? current?.showClock ?? true;
      await db.insert(scorebugSettings).values({
        id: 1, gameId: queue[0], showClock, gameQueue: JSON.stringify(queue), queueIndex: 0, activeStartedAt: now.getTime(), autoAdvanceEndsAt: null, updatedAt: now,
      }).onConflictDoUpdate({
        target: scorebugSettings.id,
        set: { gameId: queue[0], showClock, gameQueue: JSON.stringify(queue), queueIndex: 0, activeStartedAt: now.getTime(), autoAdvanceEndsAt: null, updatedAt: now },
      });
      return Response.json({ gameId: queue[0], gameQueue: queue, queueIndex: 0, showClock });
    }

    if (payload.action === "next") {
      const queue = readQueue(current?.gameQueue);
      const nextIndex = (current?.queueIndex || 0) + 1;
      if (!queue.length || nextIndex >= queue.length) {
        return Response.json({ error: "This is the last loaded game." }, { status: 409 });
      }
      await db.update(scorebugSettings).set({ gameId: queue[nextIndex], queueIndex: nextIndex, activeStartedAt: now.getTime(), autoAdvanceEndsAt: null, updatedAt: now }).where(eq(scorebugSettings.id, 1));
      return Response.json({ gameId: queue[nextIndex], gameQueue: queue, queueIndex: nextIndex });
    }

    if (payload.action === "select") {
      const queue = readQueue(current?.gameQueue);
      const selectedIndex = payload.queueIndex;
      if (selectedIndex === undefined || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= queue.length) {
        return Response.json({ error: "That game is not in the loaded queue." }, { status: 400 });
      }
      await db.update(scorebugSettings).set({ gameId: queue[selectedIndex], queueIndex: selectedIndex, activeStartedAt: now.getTime(), autoAdvanceEndsAt: null, updatedAt: now }).where(eq(scorebugSettings.id, 1));
      return Response.json({ gameId: queue[selectedIndex], gameQueue: queue, queueIndex: selectedIndex });
    }

    if (payload.action === "setManualClock") {
      const manualClockEnabled = payload.enabled === true;
      const manualClockRemainingSeconds = remainingClockSeconds(current || {}, now.getTime());
      const pauseFields = manualClockEnabled ? {} : {
        manualClockRunning: false,
        manualClockRemainingSeconds,
        manualClockEndsAt: null,
      };
      await db.insert(scorebugSettings).values({
        ...baseSettings,
        manualClockEnabled,
        ...pauseFields,
      }).onConflictDoUpdate({
        target: scorebugSettings.id,
        set: { manualClockEnabled, ...pauseFields, updatedAt: now },
      });
      return Response.json(clockPayload({ ...current, manualClockEnabled, ...pauseFields }, now.getTime()));
    }

    if (payload.action === "clockSet" || payload.action === "clockAdjust") {
      if (payload.action === "clockSet" && (!Number.isInteger(payload.seconds) || payload.seconds! < 0 || payload.seconds! > 5999)) return Response.json({ error: "Enter a time from 0:00 to 99:59." }, { status: 400 });
      if (payload.action === "clockAdjust" && payload.delta !== -1 && payload.delta !== 1) return Response.json({ error: "Invalid clock adjustment." }, { status: 400 });
      const clock = adjustManualClock(current || {}, payload.action === "clockSet" ? { seconds: payload.seconds } : { delta: payload.delta }, now.getTime());
      await db.insert(scorebugSettings).values({ ...baseSettings, ...clock }).onConflictDoUpdate({ target: scorebugSettings.id, set: { ...clock, updatedAt: now } });
      return Response.json(clockPayload(clock, now.getTime()));
    }

    if (payload.action === "clockStart") {
      const savedRemaining = remainingClockSeconds(current || {}, now.getTime());
      const manualClockRemainingSeconds = savedRemaining > 0 ? savedRemaining : 600;
      const manualClockEndsAt = now.getTime() + manualClockRemainingSeconds * 1000;
      const clock = {
        manualClockEnabled: true,
        manualClockRunning: true,
        manualClockRemainingSeconds,
        manualClockEndsAt,
      };
      await db.insert(scorebugSettings).values({ ...baseSettings, ...clock }).onConflictDoUpdate({
        target: scorebugSettings.id,
        set: { ...clock, updatedAt: now },
      });
      if (current?.activeStartedAt && !(current.manualClockRunning && savedRemaining > 0)) {
        await recordClockStart(current.gameId, current.activeStartedAt, now.getTime());
      }
      return Response.json(clockPayload(clock, now.getTime()));
    }

    if (payload.action === "clockPause") {
      const manualClockRemainingSeconds = remainingClockSeconds(current || {}, now.getTime());
      const clock = {
        manualClockEnabled: true,
        manualClockRunning: false,
        manualClockRemainingSeconds,
        manualClockEndsAt: null,
      };
      await db.insert(scorebugSettings).values({ ...baseSettings, ...clock }).onConflictDoUpdate({
        target: scorebugSettings.id,
        set: { ...clock, updatedAt: now },
      });
      return Response.json(clockPayload(clock, now.getTime()));
    }

    if (payload.action === "clockReset") {
      const clock = {
        manualClockEnabled: true,
        manualClockRunning: false,
        manualClockRemainingSeconds: 600,
        manualClockEndsAt: null,
      };
      await db.insert(scorebugSettings).values({ ...baseSettings, ...clock }).onConflictDoUpdate({
        target: scorebugSettings.id,
        set: { ...clock, updatedAt: now },
      });
      return Response.json(clockPayload(clock, now.getTime()));
    }

    if (payload.action === "updateClock") {
      const showClock = payload.showClock !== false;
      await db.insert(scorebugSettings).values({
        id: 1,
        gameId: current?.gameId || "756210",
        showClock,
        gameQueue: current?.gameQueue || "[]",
        queueIndex: current?.queueIndex || 0,
        updatedAt: now,
      }).onConflictDoUpdate({ target: scorebugSettings.id, set: { showClock, updatedAt: now } });
      return Response.json({ showClock });
    }

    return Response.json({ error: "Unknown control action." }, { status: 400 });
  } catch (error) {
    console.error("Unable to update scorebug settings", error);
    return Response.json({ error: "The scorebug controls could not be updated." }, { status: 500 });
  }
}
