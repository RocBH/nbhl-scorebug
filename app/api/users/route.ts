import { getControlUser, isControlAdmin, OWNER_EMAIL } from "@/lib/control-access";
import { getDb } from "@/db";
import { controlUsers } from "@/db/schema";
import { eq } from "drizzle-orm";
export async function GET() {
  if (!isControlAdmin(await getControlUser())) return Response.json({ error: "Admin access required." }, { status: 403 });
  const members = await getDb().select().from(controlUsers).orderBy(controlUsers.email);
  return Response.json({ users: members.map(({ email, role, userId }) => ({ email, role, joined: Boolean(userId) })) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const admin = await getControlUser();
  if (!isControlAdmin(admin)) return Response.json({ error: "Admin access required." }, { status: 403 });
  try {
    const payload = await request.json() as { email?: string; role?: string; action?: string };
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    if (email === OWNER_EMAIL || email === admin?.email.toLowerCase()) return Response.json({ error: "You cannot change or remove this account." }, { status: 400 });
    const db = getDb();
    if (payload.action === "remove") {
      await db.delete(controlUsers).where(eq(controlUsers.email, email));
    } else if (payload.action === "save" && (payload.role === "admin" || payload.role === "operator")) {
      await db.insert(controlUsers).values({ email, role: payload.role }).onConflictDoUpdate({ target: controlUsers.email, set: { role: payload.role } });
    } else return Response.json({ error: "Invalid user action." }, { status: 400 });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Could not save user access. Try again." }, { status: 500 }); }
}
