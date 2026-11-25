import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import {
  getAnalyticsSnapshot,
  parseAnalyticsOffset,
  parseAnalyticsRange,
} from "@/lib/adminAnalytics";

export const dynamic = "force-dynamic";

type Snapshot = Awaited<ReturnType<typeof getAnalyticsSnapshot>>;
const CACHE = new Map<string, { data: Snapshot; expiresAt: number }>();

/** Datos agregados del panel; nunca expone identificadores de visitantes. */
export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const range = parseAnalyticsRange(req.nextUrl.searchParams.get("range"));
  const offset = parseAnalyticsOffset(req.nextUrl.searchParams.get("offset"));
  const fresh = req.nextUrl.searchParams.get("fresh") === "1";

  const key = `${range}:${offset}`;
  const now = Date.now();
  const cached = CACHE.get(key);

  if (!fresh && cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data, {
      headers: {
        "Cache-Control": offset > 0 ? "private, max-age=120" : "private, max-age=15",
      },
    });
  }

  const snapshot = await getAnalyticsSnapshot(range, offset);

  // Períodos pasados no cambian (5 min); el período actual se guarda 20 s para
  // absorber clics repetidos o recargas sin multiplicar consultas en PostgreSQL.
  const ttlMs = offset > 0 ? 5 * 60_000 : 20_000;
  if (CACHE.size > 48) {
    const oldestKey = CACHE.keys().next().value;
    if (oldestKey !== undefined) CACHE.delete(oldestKey);
  }
  CACHE.set(key, { data: snapshot, expiresAt: now + ttlMs });

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": offset > 0 ? "private, max-age=120" : "private, max-age=15",
    },
  });
}
