import { getDb } from "@/db";
import { scorebugSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const [settings] = await getDb().select().from(scorebugSettings).where(eq(scorebugSettings.id, 1)).limit(1);
    return Response.json({
      showClock: settings?.showClock ?? true,
      manualClockEnabled: settings?.manualClockEnabled ?? false,
      manualClockRunning: settings?.manualClockRunning ?? false,
      manualClockRemainingSeconds: settings?.manualClockRemainingSeconds ?? 600,
      manualClockEndsAt: settings?.manualClockEndsAt ?? null,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch { return Response.json({ error: "Clock unavailable" }, { status: 503 }); }
}
