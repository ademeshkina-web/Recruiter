import { NextResponse } from "next/server";
import { hasApiKey, MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Показывает интерфейсу, в каком режиме работает бэкенд.
export async function GET() {
  return NextResponse.json({ live: hasApiKey(), model: MODEL });
}
