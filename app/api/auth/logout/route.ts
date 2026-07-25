import { NextResponse } from "next/server";
import { clearedCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearedCookie());
  return res;
}
