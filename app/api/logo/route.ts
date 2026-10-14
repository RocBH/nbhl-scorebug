import { NextRequest } from "next/server";

const ALLOWED_HOSTS = new Set(["cache.kreezee.com", "thenbhl.com", "www.thenbhl.com"]);

export async function GET(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("url");
  if (!value) return new Response("Missing logo URL", { status: 400 });

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
      return new Response("Logo host not allowed", { status: 400 });
    }
    const source = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const contentType = source.headers.get("content-type") || "";
    if (!source.ok || !contentType.startsWith("image/")) {
      return new Response("Logo unavailable", { status: 502 });
    }
    return new Response(await source.arrayBuffer(), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch {
    return new Response("Logo unavailable", { status: 502 });
  }
}
