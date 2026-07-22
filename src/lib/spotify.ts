import { cookies } from "next/headers";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_NOW_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing";
const SPOTIFY_SCOPE = "user-read-currently-playing";
const SPOTIFY_REFRESH_TOKEN_COOKIE = "spotify_refresh_token";
const SPOTIFY_STATE_COOKIE = "spotify_auth_state";
const SPOTIFY_REDIRECT_PATH = "/api/spotify/callback";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const STATE_MAX_AGE_SECONDS = 60 * 10;

type SpotifyTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
};

type SpotifyArtist = {
  name?: unknown;
};

type SpotifyTrack = {
  artists?: unknown;
  name?: unknown;
  type?: unknown;
};

type SpotifyCurrentlyPlayingResponse = {
  item?: unknown;
};

export type SpotifyNowPlayingResult =
  | { answer: string; status: "ok" }
  | { answer: string; status: "needs_auth" }
  | { answer: string; status: "not_playing" }
  | { answer: string; status: "error" };

function getSpotifyConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

function getBasicAuthorization(clientId: string, clientSecret: string): string {
  return Buffer.from(clientId + ":" + clientSecret).toString("base64");
}

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function getSpotifyRedirectUri(requestUrl: string): string {
  const config = getSpotifyConfig();

  if (config?.redirectUri) {
    return config.redirectUri;
  }

  return new URL(SPOTIFY_REDIRECT_PATH, requestUrl).toString();
}

export function hasSpotifyConfig(): boolean {
  return getSpotifyConfig() !== null;
}

export async function createSpotifyConnectUrl(requestUrl: string): Promise<string | null> {
  const config = getSpotifyConfig();

  if (config === null) {
    return null;
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(SPOTIFY_STATE_COOKIE, state, getCookieOptions(STATE_MAX_AGE_SECONDS));

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getSpotifyRedirectUri(requestUrl),
    response_type: "code",
    scope: SPOTIFY_SCOPE,
    state,
  });

  return SPOTIFY_AUTH_URL + "?" + params.toString();
}

export async function exchangeSpotifyCode(
  code: string,
  state: string | null,
  requestUrl: string,
): Promise<boolean> {
  const config = getSpotifyConfig();

  if (config === null || state === null) {
    return false;
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get(SPOTIFY_STATE_COOKIE)?.value;
  cookieStore.delete(SPOTIFY_STATE_COOKIE);

  if (!storedState || storedState !== state) {
    return false;
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + getBasicAuthorization(config.clientId, config.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: getSpotifyRedirectUri(requestUrl),
    }),
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as SpotifyTokenResponse;

  if (typeof data.refresh_token !== "string") {
    return false;
  }

  cookieStore.set(
    SPOTIFY_REFRESH_TOKEN_COOKIE,
    data.refresh_token,
    getCookieOptions(COOKIE_MAX_AGE_SECONDS),
  );

  return true;
}

async function getSpotifyAccessToken(): Promise<string | null> {
  const config = getSpotifyConfig();
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value;

  if (config === null || !refreshToken) {
    return null;
  }

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: "Basic " + getBasicAuthorization(config.clientId, config.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    cookieStore.delete(SPOTIFY_REFRESH_TOKEN_COOKIE);
    return null;
  }

  const data = (await response.json()) as SpotifyTokenResponse;

  if (typeof data.refresh_token === "string") {
    cookieStore.set(
      SPOTIFY_REFRESH_TOKEN_COOKIE,
      data.refresh_token,
      getCookieOptions(COOKIE_MAX_AGE_SECONDS),
    );
  }

  return typeof data.access_token === "string" ? data.access_token : null;
}

function getArtistNames(item: SpotifyTrack): string {
  if (!Array.isArray(item.artists)) {
    return "UNKNOWN ARTIST";
  }

  const names = item.artists
    .map((artist: SpotifyArtist) => artist.name)
    .filter((name): name is string => typeof name === "string" && name.length > 0);

  return names.length > 0 ? names.join(", ") : "UNKNOWN ARTIST";
}

export async function getSpotifyNowPlaying(): Promise<SpotifyNowPlayingResult> {
  if (!hasSpotifyConfig()) {
    return { answer: "SPOTIFY NOT SETUP", status: "error" };
  }

  const accessToken = await getSpotifyAccessToken();

  if (accessToken === null) {
    return { answer: "CONNECT SPOTIFY", status: "needs_auth" };
  }

  try {
    const response = await fetch(SPOTIFY_NOW_PLAYING_URL, {
      headers: { Authorization: "Bearer " + accessToken },
    });

    if (response.status === 204) {
      return { answer: "NOTHING PLAYING", status: "not_playing" };
    }

    if (response.status === 401 || response.status === 403) {
      return { answer: "CONNECT SPOTIFY", status: "needs_auth" };
    }

    if (!response.ok) {
      return { answer: "SPOTIFY UNAVAILABLE", status: "error" };
    }

    const data = (await response.json()) as SpotifyCurrentlyPlayingResponse;

    if (typeof data.item !== "object" || data.item === null) {
      return { answer: "NOTHING PLAYING", status: "not_playing" };
    }

    const item = data.item as SpotifyTrack;

    if (typeof item.name !== "string") {
      return { answer: "NOTHING PLAYING", status: "not_playing" };
    }

    return {
      answer: "NOW PLAYING\n\n" + getArtistNames(item) + "\n" + item.name,
      status: "ok",
    };
  } catch {
    return { answer: "SPOTIFY UNAVAILABLE", status: "error" };
  }
}

export async function disconnectSpotify() {
  const cookieStore = await cookies();
  cookieStore.delete(SPOTIFY_REFRESH_TOKEN_COOKIE);
}

export const SPOTIFY_CALLBACK_SUCCESS_PATH = "/?spotify=connected";
export const SPOTIFY_CALLBACK_ERROR_PATH = "/?spotify=error";
