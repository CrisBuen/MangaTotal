import { NextRequest, NextResponse } from "next/server";
import { getSessionAdmin } from "@/lib/auth";
import {
  getAnalyticsSnapshot,
  parseAnalyticsOffset,
  parseAnalyticsRange,
} from "@/lib/adminAnalytics";

export const dynamic = "force-dynamic";

/** Datos agregados del panel; nunca expone identificadores de visitantes. */
export async function GET(req: NextRequest) {
  const admin = await getSessionAdmin();
  if (!admin) return NextResponse.json({ error: "Solo admin" }, { status: 403 });

  const range = parseAnalyticsRange(req.nextUrl.searchParams.get("range"));
  const offset = parseAnalyticsOffset(req.nextUrl.searchParams.get("offset"));
  const snapshot = await getAnalyticsSnapshot(range, offset);

  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
