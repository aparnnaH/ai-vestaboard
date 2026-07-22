import { NextResponse } from "next/server";

const OLLAMA_URL = "http://127.0.0.1:11434/api/generate";
const OLLAMA_MODEL = "llama3.2:3b";
const MAX_QUESTION_LENGTH = 500;
const OLLAMA_UNAVAILABLE_MESSAGE = "OLLAMA IS UNAVAILABLE";

type AskRequestBody = {
  question?: unknown;
};

type OllamaGenerateResponse = {
  response?: unknown;
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

  if (question === null) {
    return NextResponse.json(
      { error: "Question must be 1 to 500 characters." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: `Answer this question in no more than 100 characters. Use plain text only.\n\nQuestion: ${question}`,
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

    if (typeof data.response !== "string" || data.response.trim().length === 0) {
      return NextResponse.json(
        { answer: "NO ANSWER AVAILABLE" },
        { status: 502 },
      );
    }

    return NextResponse.json({ answer: data.response.trim().slice(0, 100) });
  } catch {
    return NextResponse.json(
      { answer: OLLAMA_UNAVAILABLE_MESSAGE },
      { status: 503 },
    );
  }
}
