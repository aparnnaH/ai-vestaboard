import { NextResponse } from "next/server";

const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";
const OLLAMA_MODEL = "llama3.2:3b";
const WEATHER_URL = "https://wttr.in";
const MAX_QUESTION_LENGTH = 500;
const MAX_ANSWER_LENGTH = 100;
const OLLAMA_UNAVAILABLE_MESSAGE = "OLLAMA IS UNAVAILABLE";
const WEATHER_UNAVAILABLE_MESSAGE = "WEATHER UNAVAILABLE";
const TIME_ZONE = "America/Toronto";

type AskRequestBody = {
  latitude?: unknown;
  longitude?: unknown;
  question?: unknown;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type OllamaGenerateResponse = {
  response?: unknown;
};

type WeatherResponse = {
  current_condition?: Array<{
    temp_F?: unknown;
    weatherDesc?: Array<{ value?: unknown }>;
  }>;
  nearest_area?: Array<{
    areaName?: Array<{ value?: unknown }>;
  }>;
};

function getQuestion(body: AskRequestBody): string | null {
  if (typeof body.question !== "string") {
    return null;
  }

  const question = body.question.trim();

  if (question.length === 0 || question.length > MAX_QUESTION_LENGTH) {
    return null;
  }

  return question;
}

function getCoordinates(body: AskRequestBody): Coordinates | null {
  if (typeof body.latitude !== "number" || typeof body.longitude !== "number") {
    return null;
  }

  if (
    !Number.isFinite(body.latitude) ||
    !Number.isFinite(body.longitude) ||
    body.latitude < -90 ||
    body.latitude > 90 ||
    body.longitude < -180 ||
    body.longitude > 180
  ) {
    return null;
  }

  return { latitude: body.latitude, longitude: body.longitude };
}

function getCurrentDate(): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: TIME_ZONE,
  }).format(new Date());
}

function getCurrentDay(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "long",
  }).format(new Date());
}

function getCurrentTime(): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
    timeZoneName: "short",
  }).format(new Date());
}

function normalizeAnswer(answer: string): string {
  return answer.replace(/\s+/g, " ").trim().slice(0, MAX_ANSWER_LENGTH);
}

function getLocalRealtimeAnswer(question: string): string | null {
  const normalizedQuestion = question.toLowerCase();

  if (/\b(weather|temperature|forecast)\b/.test(normalizedQuestion)) {
    return null;
  }

  if (/\b(time|current time|what time)\b/.test(normalizedQuestion)) {
    return "IT IS " + getCurrentTime();
  }

  if (/\b(day|weekday)\b/.test(normalizedQuestion)) {
    return "TODAY IS " + getCurrentDay();
  }

  if (/\b(date|today)\b/.test(normalizedQuestion)) {
    return "TODAY IS " + getCurrentDate();
  }

  return null;
}

function getWeatherLocation(question: string): string | null {
  const match = question.match(
    /(?:weather|temperature|forecast)(?:\s+(?:in|for|at))?\s+(.+)/i,
  );
  const location = match?.[1]?.replace(/[?!.]+$/g, "").trim();

  if (!location) {
    return null;
  }

  return location;
}

async function fetchWeather(location: string): Promise<string> {
  try {
    const response = await fetch(
      WEATHER_URL + "/" + encodeURIComponent(location) + "?format=j1",
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      return WEATHER_UNAVAILABLE_MESSAGE;
    }

    const data = (await response.json()) as WeatherResponse;
    const current = data.current_condition?.[0];
    const area = data.nearest_area?.[0]?.areaName?.[0]?.value;
    const description = current?.weatherDesc?.[0]?.value;

    if (typeof current?.temp_F !== "string" || typeof description !== "string") {
      return WEATHER_UNAVAILABLE_MESSAGE;
    }

    const place = typeof area === "string" && area.length > 0 ? area : location;

    return normalizeAnswer(place + ": " + current.temp_F + "F " + description);
  } catch {
    return WEATHER_UNAVAILABLE_MESSAGE;
  }
}

async function getWeatherAnswer(question: string): Promise<string | null> {
  if (!/\b(weather|temperature|forecast)\b/i.test(question)) {
    return null;
  }

  const location = getWeatherLocation(question);

  if (location === null) {
    return "ASK WEATHER LOCATION";
  }

  return fetchWeather(location);
}

export async function POST(request: Request) {
  let body: AskRequestBody;

  try {
    body = (await request.json()) as AskRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Question must be sent as JSON." },
      { status: 400 },
    );
  }

  const question = getQuestion(body);
  const coordinates = getCoordinates(body);

  if (question === null) {
    return NextResponse.json(
      { error: "Question must be 1 to 500 characters." },
      { status: 400 },
    );
  }

  if (coordinates !== null && /\b(weather|temperature|forecast)\b/i.test(question)) {
    const location =
      coordinates.latitude.toFixed(4) + "," + coordinates.longitude.toFixed(4);

    return NextResponse.json({ answer: await fetchWeather(location) });
  }

  const realtimeAnswer =
    getLocalRealtimeAnswer(question) ?? (await getWeatherAnswer(question));

  if (realtimeAnswer !== null) {
    return NextResponse.json({ answer: normalizeAnswer(realtimeAnswer) });
  }

  const currentDate = getCurrentDate();

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt:
          "Today is " +
          currentDate +
          ". Answer this question in one plain-text line. " +
          "If asked for today's date, use today's date exactly. " +
          "Use no more than " +
          MAX_ANSWER_LENGTH +
          " characters.\n\nQuestion: " +
          question,
        stream: false,
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { answer: OLLAMA_UNAVAILABLE_MESSAGE },
        { status: 502 },
      );
    }

    const data = (await response.json()) as OllamaGenerateResponse;

    if (typeof data.response !== "string") {
      return NextResponse.json(
        { answer: "NO ANSWER AVAILABLE" },
        { status: 502 },
      );
    }

    const answer = normalizeAnswer(data.response);

    if (answer.length === 0) {
      return NextResponse.json(
        { answer: "NO ANSWER AVAILABLE" },
        { status: 502 },
      );
    }

    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json(
      { answer: OLLAMA_UNAVAILABLE_MESSAGE },
      { status: 503 },
    );
  }
}
