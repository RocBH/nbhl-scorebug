import { env } from "cloudflare:workers";
import { getControlUser } from "@/lib/control-access";
import { getDb } from "@/db";
import { sponsorSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const [settings] = await getDb().select().from(sponsorSettings).where(eq(sponsorSettings.id, 1)).limit(1);
    if (new URL(request.url).searchParams.has("image")) {
      if (!settings?.imageKey) return new Response(null, { status: 404 });
      const object = await env.ASSETS.get(settings.imageKey);
      if (!object) return new Response(null, { status: 404 });
      return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType || "image/png", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
    }
    return Response.json(settings || { imageKey: "", width: 240, right: 98, top: 75, opacity: 100, visible: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Logo unavailable." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!(await getControlUser())) return Response.json({ error: "Control board access required." }, { status: 403 });
  try {
    const db = getDb();
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const file = (await request.formData()).get("logo");
      if (!(file instanceof File) || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 5 * 1024 * 1024) {
        return Response.json({ error: "Choose a PNG, JPG, WebP, or GIF under 5 MB." }, { status: 400 });
      }
      const imageKey = `sponsors/${crypto.randomUUID()}`;
      await env.ASSETS.put(imageKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
      await db.insert(sponsorSettings).values({ id: 1, imageKey }).onConflictDoUpdate({ target: sponsorSettings.id, set: { imageKey, visible: true } });
    } else {
      const payload = await request.json() as Record<string, unknown>;
      const values: { width?: number; right?: number; top?: number; opacity?: number; visible?: boolean } = {};
      for (const [key, min, max] of [["width", 40, 1000], ["right", 0, 1920], ["top", 0, 1080], ["opacity", 0, 100]] as const) {
        if (payload[key] !== undefined) {
          const value = Number(payload[key]);
          if (!Number.isFinite(value)) return Response.json({ error: "Invalid logo setting." }, { status: 400 });
          values[key] = Math.round(Math.min(max, Math.max(min, value)));
        }
      }
      if (typeof payload.visible === "boolean") values.visible = payload.visible;
      await db.insert(sponsorSettings).values({ id: 1, ...values }).onConflictDoUpdate({ target: sponsorSettings.id, set: values });
    }
    const [settings] = await db.select().from(sponsorSettings).where(eq(sponsorSettings.id, 1));
    return Response.json(settings);
  } catch { return Response.json({ error: "Could not save the sponsor logo." }, { status: 503 }); }
}
