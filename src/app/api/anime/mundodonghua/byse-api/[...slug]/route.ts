import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy ultraligero de peticiones de metadatos (settings, captcha, verificación)
 * hacia Bysekoze (Filemoon).
 * Únicamente transfiere respuestas JSON de menos de 1 KB; ningún byte de video
 * pasa por Vercel (los chunks HLS y el video son consumidos directamente por JWPlayer).
 */
async function proxyByse(req: NextRequest, slug: string[]) {
  const path = slug.join("/");
  const search = req.nextUrl.search;
  const targetUrl = `https://bysekoze.com/api/videos/${path}${search}`;

  const forwardHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "X-Embed-Origin": "mundodonghua.com",
    "X-Embed-Referer": "https://www.mundodonghua.com/",
    Referer: "https://www.mundodonghua.com/",
    Origin: "https://www.mundodonghua.com",
  };

  const contentType = req.headers.get("content-type");
  if (contentType) forwardHeaders["Content-Type"] = contentType;

  const captchaToken = req.headers.get("x-captcha-token");
  if (captchaToken) forwardHeaders["X-Captcha-Token"] = captchaToken;

  const method = req.method.toUpperCase();
  let body: BodyInit | undefined = undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await req.text();
  }

  const res = await fetch(targetUrl, {
    method,
    headers: forwardHeaders,
    body,
  });

  const responseBody = await res.arrayBuffer();

  return new NextResponse(responseBody, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  return proxyByse(req, slug);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params;
  return proxyByse(req, slug);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
