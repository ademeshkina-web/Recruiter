import { NextResponse } from "next/server";
import { hasApiKey, MODEL } from "@/lib/anthropic";
import { usingDatabase } from "@/lib/db";
import { hasPotok } from "@/lib/potok";
import { hasLinkedIn } from "@/lib/linkedin";
import { hasTgstat } from "@/lib/tgstat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Показывает интерфейсу, в каком режиме работает бэкенд.
export async function GET() {
  return NextResponse.json({
    live: hasApiKey(),
    model: MODEL,
    db: usingDatabase(),
    potok: hasPotok(),
    linkedin: hasLinkedIn(),
    telegram: hasTgstat(),
  });
}
