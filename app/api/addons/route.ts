import { getDb } from "@/db";
import { addonSettings } from "@/db/schema";
import { getControlUser } from "@/lib/control-access";
import { eq } from "drizzle-orm";
export async function GET() {
  const [value] = await getDb().select().from(addonSettings).where(eq(addonSettings.id, 1));
  return Response.json(value || { left: "off", right: "off" }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!(await getControlUser())) return Response.json({ error: "Control board access required" }, { status: 403 });
  const payload = await request.json();
  const order = ["powerplay", "two-man", "empty-net", "timeout"];
  if (!["left", "right"].includes(payload.side) || !order.includes(payload.graphic)) return Response.json({ error: "Invalid graphic" }, { status: 400 });
  const [current] = await getDb().select().from(addonSettings).where(eq(addonSettings.id, 1));
  const selected = new Set((current?.[payload.side as "left" | "right"] || "off").split(",").filter(item => order.includes(item)));
  if (selected.has(payload.graphic)) selected.delete(payload.graphic); else selected.add(payload.graphic);
  const value = { [payload.side]: order.filter(item => selected.has(item)).join(",") || "off" };
  await getDb().insert(addonSettings).values({ id: 1, ...value }).onConflictDoUpdate({ target: addonSettings.id, set: value });
  return GET();
}
