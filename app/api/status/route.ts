import { NextResponse } from "next/server";
import { hasApiKey, MODEL } from "@/lib/anthropic";
import { usingDatabase } from "@/lib/db";
import { hasPotok } from "@/lib/potok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Показывает интерфейсу, в каком режиме работает бэкенд.
export async function GET() {
  return NextResponse.json({
    live: hasApiKey(),
    model: MODEL,
    db: usingDatabase(),
    potok: hasPotok(),
  });
}
