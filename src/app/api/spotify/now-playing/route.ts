import { NextResponse } from "next/server";
import { getSpotifyNowPlaying } from "@/lib/spotify";

export async function GET() {
  const result = await getSpotifyNowPlaying();

  return NextResponse.json(result);
}
