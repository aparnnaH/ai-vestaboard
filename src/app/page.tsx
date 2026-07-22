"use client";

import { FormEvent, useState } from "react";
import { SplitFlapBoard } from "@/components/SplitFlapBoard";

const INITIAL_MESSAGE = `ASK ME ANYTHING

YOUR AI ANSWER
WILL APPEAR HERE`;
const LOADING_MESSAGE = "THINKING";
const ERROR_MESSAGE = "OLLAMA IS UNAVAILABLE";

type AskResponse = {
  answer?: unknown;
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [boardMessage, setBoardMessage] = useState(INITIAL_MESSAGE);
  const [isLoading, setIsLoading] = useState(false);
  const isAskDisabled = question.trim().length === 0 || isLoading;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isAskDisabled) {
      return;
    }

    setIsLoading(true);
    setBoardMessage(LOADING_MESSAGE);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await response.json()) as AskResponse;

      if (!response.ok || typeof data.answer !== "string") {
        setBoardMessage(ERROR_MESSAGE);
        return;
      }

      setBoardMessage(data.answer);
      setQuestion("");
    } catch {
      setBoardMessage(ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setBoardMessage(INITIAL_MESSAGE);
    setQuestion("");
    setIsLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-3 py-10 text-zinc-100 sm:px-6">
      <div className="flex w-full max-w-6xl flex-col items-center gap-6">
        <SplitFlapBoard message={boardMessage} />
        <form
          className="flex w-full max-w-3xl flex-col gap-3 px-3 sm:flex-row sm:px-6"
          onSubmit={handleSubmit}
        >
          <label className="sr-only" htmlFor="question">
            Question
          </label>
          <input
            id="question"
            className="min-h-11 flex-1 rounded border border-zinc-700 bg-zinc-900 px-4 font-mono text-sm uppercase text-zinc-100 outline-none ring-white/20 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 disabled:cursor-not-allowed disabled:text-zinc-500"
            disabled={isLoading}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="ASK A QUESTION"
            type="text"
            value={question}
          />
          <button
            className="min-h-11 rounded bg-zinc-100 px-5 font-mono text-sm font-bold uppercase text-zinc-950 transition disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            disabled={isAskDisabled}
            type="submit"
          >
            {isLoading ? "Asking" : "Ask"}
          </button>
          <button
            className="min-h-11 rounded border border-zinc-700 px-4 font-mono text-sm font-bold uppercase text-zinc-200 transition hover:border-zinc-500"
            onClick={handleReset}
            type="button"
          >
            Reset
          </button>
        </form>
      </div>
    </main>
  );
}
