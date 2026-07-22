import { NextResponse } from "next/server";
import {
  SPOTIFY_CALLBACK_ERROR_PATH,
  SPOTIFY_CALLBACK_SUCCESS_PATH,
  exchangeSpotifyCode,
} from "@/lib/spotify";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (code === null) {
    return NextResponse.redirect(new URL(SPOTIFY_CALLBACK_ERROR_PATH, request.url));
  }

  const didConnect = await exchangeSpotifyCode(code, state, request.url);

  return NextResponse.redirect(
    new URL(
      didConnect ? SPOTIFY_CALLBACK_SUCCESS_PATH : SPOTIFY_CALLBACK_ERROR_PATH,
      request.url,
    ),
  );
}
