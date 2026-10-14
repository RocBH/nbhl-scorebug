import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { controlUsers } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const OWNER_EMAIL = "mpdzs7g8b7@privaterelay.appleid.com";
export type ControlRole = "owner" | "admin" | "operator";
export type ControlUser = ChatGPTUser & { role: ControlRole };

export async function getControlUser(identity?: ChatGPTUser): Promise<ControlUser | null> {
  const user = identity || await getChatGPTUser();
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  const db = getDb();
  if (email === OWNER_EMAIL) {
    await db.insert(controlUsers).values({ email, userId: user.userId, role: "owner" }).onConflictDoNothing();
  }
  let [member] = await db.select().from(controlUsers).where(eq(controlUsers.email, email)).limit(1);
  if (!member || !["owner", "admin", "operator"].includes(member.role)) return null;
  if (member.userId == null) {
    await db.update(controlUsers).set({ userId: user.userId }).where(and(eq(controlUsers.email, email), isNull(controlUsers.userId)));
    [member] = await db.select().from(controlUsers).where(eq(controlUsers.email, email)).limit(1);
  }
  if (member?.userId !== user.userId) return null;
  return { ...user, role: member.role as ControlRole };
}
export function isControlAdmin(user: ControlUser | null) {
  return user?.role === "owner" || user?.role === "admin";
}
