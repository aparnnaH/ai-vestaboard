import { NextResponse } from "next/server";
import { createSpotifyConnectUrl } from "@/lib/spotify";

export async function GET(request: Request) {
  const connectUrl = await createSpotifyConnectUrl(request.url);

  if (connectUrl === null) {
    return NextResponse.redirect(new URL("/?spotify=not_setup", request.url));
  }

  return NextResponse.redirect(connectUrl);
}
