import { getControlUser } from "@/lib/control-access";
import { getDb } from "@/db";
import { gameOverrides, scorebugSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  if (!(await getControlUser())) return Response.json({ error: "Control board access required." }, { status: 403 });
  try {
    const payload = await request.json() as { gameId?: string; field?: string; value?: number | null; reset?: boolean };
    const db = getDb();
    const [current] = await db.select().from(scorebugSettings).where(eq(scorebugSettings.id, 1)).limit(1);
    const gameId = current?.gameId || "756210";
    if (payload.gameId !== gameId) return Response.json({ error: "The active game changed. Try again." }, { status: 409 });
    if (payload.reset === true) {
      await db.delete(gameOverrides).where(eq(gameOverrides.gameId, gameId));
    } else {
      const field = payload.field;
      if (field !== "visitorScore" && field !== "homeScore" && field !== "period") return Response.json({ error: "Invalid control." }, { status: 400 });
      const value = payload.value;
      if (value !== null && (typeof value !== "number" || !Number.isInteger(value) || (field === "period" ? ![1,2,3,4,9,99].includes(value) : value < 0 || value > 99))) return Response.json({ error: "Invalid score or period." }, { status: 400 });
      const update = { [field]: value };
      await db.insert(gameOverrides).values({ gameId, ...update }).onConflictDoUpdate({ target: gameOverrides.gameId, set: update });
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not update manual controls." }, { status: 500 });
  }
}
