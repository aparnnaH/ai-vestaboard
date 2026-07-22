"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  FLAP_STAGGER_MS,
  FLAP_STEP_MS,
  SplitFlapBoard,
} from "@/components/SplitFlapBoard";
import { useSplitFlapAudio } from "@/hooks/useSplitFlapAudio";
import { useVoiceInput } from "@/hooks/useVoiceInput";

const INITIAL_MESSAGE = `ASK ME ANYTHING

YOUR AI ANSWER
WILL APPEAR HERE`;
const LOADING_MESSAGE = "THINKING";
const ERROR_MESSAGE = "OLLAMA IS UNAVAILABLE";
const LOCATION_LOADING_MESSAGE = "FINDING LOCATION";
const LOCATION_ERROR_MESSAGE = "LOCATION UNAVAILABLE";
const SPOTIFY_LOADING_MESSAGE = "CHECKING SPOTIFY";
const SPOTIFY_ERROR_MESSAGE = "SPOTIFY UNAVAILABLE";
const PROFILE_STORAGE_KEY = "ai-vestaboard-profile";
const REMINDERS_STORAGE_KEY = "ai-vestaboard-reminders";
const ROTATION_INTERVAL_MS = 45000;
const DEFAULT_PROFILE = {
  name: "APARNNA",
  note: "TODAY IS YOURS",
  wakeTime: "07:30",
};

type WelcomeProfile = typeof DEFAULT_PROFILE;

type AskResponse = {
  answer?: unknown;
};

type SpotifyResponse = {
  answer?: unknown;
  status?: unknown;
};

type Reminder = {
  id: string;
  text: string;
  time: string;
};

function getStoredProfile(): WelcomeProfile {
  if (typeof window === "undefined") {
    return DEFAULT_PROFILE;
  }

  const storedProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY);

  if (storedProfile === null) {
    return DEFAULT_PROFILE;
  }

  try {
    const profile = JSON.parse(storedProfile) as Partial<WelcomeProfile>;

    return {
      name: typeof profile.name === "string" ? profile.name : DEFAULT_PROFILE.name,
      note: typeof profile.note === "string" ? profile.note : DEFAULT_PROFILE.note,
      wakeTime:
        typeof profile.wakeTime === "string" ? profile.wakeTime : DEFAULT_PROFILE.wakeTime,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function getTodayLabel(): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date());
}

function getTimeLabel(): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function getNextReminder(reminders: readonly Reminder[]): Reminder | null {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    [...reminders]
      .sort((first, second) => first.time.localeCompare(second.time))
      .find((reminder) => {
        const [hours = "0", minutes = "0"] = reminder.time.split(":");
        return Number(hours) * 60 + Number(minutes) >= currentMinutes;
      }) ?? null
  );
}

function getWelcomeMessage(
  profile: WelcomeProfile,
  reminders: readonly Reminder[] = [],
  weatherMessage = "WEATHER TAP LOCATION",
): string {
  const nextReminder = getNextReminder(reminders);

  return `GOOD MORNING ${profile.name}
${getTodayLabel()}
${weatherMessage}
${
    nextReminder ? `NEXT: ${nextReminder.text} ${nextReminder.time}` : profile.note
  }`;
}

function saveProfile(profile: WelcomeProfile) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  }
}

function getStoredReminders(): Reminder[] {
  if (typeof window === "undefined") {
    return [];
  }

  const storedReminders = window.localStorage.getItem(REMINDERS_STORAGE_KEY);

  if (storedReminders === null) {
    return [];
  }

  try {
    const reminders = JSON.parse(storedReminders) as Array<Partial<Reminder>>;

    return reminders.filter((reminder): reminder is Reminder => {
      return (
        typeof reminder.id === "string" &&
        typeof reminder.text === "string" &&
        typeof reminder.time === "string"
      );
    });
  } catch {
    return [];
  }
}

function saveReminders(reminders: readonly Reminder[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
  }
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [profile, setProfile] = useState(getStoredProfile);
  const [reminders, setReminders] = useState(getStoredReminders);
  const [reminderText, setReminderText] = useState("");
  const [reminderTime, setReminderTime] = useState("09:00");
  const [weatherMessage, setWeatherMessage] = useState("WEATHER TAP LOCATION");
  const [customNote, setCustomNote] = useState(DEFAULT_PROFILE.note);
  const [boardMessage, setBoardMessage] = useState(() => {
    const storedProfile = getStoredProfile();
    return getWelcomeMessage(storedProfile, getStoredReminders());
  });
  const rotationIndex = useRef(0);
  const shownReminderIds = useRef<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isCheckingSpotify, setIsCheckingSpotify] = useState(false);
  const {
    isMuted,
    isSupported,
    playSequence,
    setIsMuted,
    setVolume,
    unlockAudio,
    volume,
  } = useSplitFlapAudio();
  const isAskDisabled =
    question.trim().length === 0 || isLoading || isLocating || isCheckingSpotify;
  const isLocationSupported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const handleVoiceTranscript = useCallback((transcript: string) => {
    setQuestion(transcript);
  }, []);
  const { isListening, isSupported: isVoiceSupported, startListening, stopListening } =
    useVoiceInput({ onTranscript: handleVoiceTranscript });

  const handleCharactersChange = useCallback(
    (changedTileIndexes: number[], reducedMotion: boolean) => {
      playSequence({
        changedTileIndexes,
        reducedMotion,
        staggerMs: FLAP_STAGGER_MS,
        stepMs: FLAP_STEP_MS,
      });
    },
    [playSequence],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    unlockAudio();

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

  function handleShowWelcome() {
    unlockAudio();
    setBoardMessage(getWelcomeMessage(profile, reminders, weatherMessage));
  }

  function handleProfileChange(nextProfile: WelcomeProfile) {
    setProfile(nextProfile);
    setCustomNote(nextProfile.note);
    saveProfile(nextProfile);
  }

  function handleAddReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = reminderText.trim();

    if (text.length === 0) {
      return;
    }

    const nextReminders = [
      ...reminders,
      { id: crypto.randomUUID(), text: text.toUpperCase(), time: reminderTime },
    ].sort((first, second) => first.time.localeCompare(second.time));

    setReminders(nextReminders);
    saveReminders(nextReminders);
    setReminderText("");
    setBoardMessage(`REMINDER SET\n\n${text.toUpperCase()}\n${reminderTime}`);
  }

  function handleRemoveReminder(reminderId: string) {
    const nextReminders = reminders.filter((reminder) => reminder.id !== reminderId);
    setReminders(nextReminders);
    saveReminders(nextReminders);
  }

  function handleReset() {
    unlockAudio();
    setBoardMessage(INITIAL_MESSAGE);
    setQuestion("");
    setIsLoading(false);
    setIsLocating(false);
    setIsCheckingSpotify(false);
  }

  async function handleSpotifyNowPlaying() {
    unlockAudio();
    setIsCheckingSpotify(true);
    setBoardMessage(SPOTIFY_LOADING_MESSAGE);

    try {
      const response = await fetch("/api/spotify/now-playing");
      const data = (await response.json()) as SpotifyResponse;

      if (data.status === "needs_auth") {
        window.location.href = "/api/spotify/connect";
        return;
      }

      if (!response.ok || typeof data.answer !== "string") {
        setBoardMessage(SPOTIFY_ERROR_MESSAGE);
        return;
      }

      setBoardMessage(data.answer);
    } catch {
      setBoardMessage(SPOTIFY_ERROR_MESSAGE);
    } finally {
      setIsCheckingSpotify(false);
    }
  }

  function handleUseLocation() {
    unlockAudio();

    if (!isLocationSupported) {
      setBoardMessage(LOCATION_ERROR_MESSAGE);
      return;
    }

    setIsLocating(true);
    setBoardMessage(LOCATION_LOADING_MESSAGE);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch("/api/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              question: "weather",
            }),
          });
          const data = (await response.json()) as AskResponse;

          if (!response.ok || typeof data.answer !== "string") {
            setBoardMessage(LOCATION_ERROR_MESSAGE);
            return;
          }

          setWeatherMessage(data.answer);
          setBoardMessage(data.answer);
        } catch {
          setBoardMessage(LOCATION_ERROR_MESSAGE);
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setBoardMessage(LOCATION_ERROR_MESSAGE);
        setIsLocating(false);
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 },
    );
  }

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const dueReminder = reminders.find((reminder) => {
        return reminder.time === new Date().toTimeString().slice(0, 5);
      });

      if (dueReminder && !shownReminderIds.current.has(dueReminder.id)) {
        shownReminderIds.current.add(dueReminder.id);
        setBoardMessage(`REMINDER\n\n${dueReminder.text}\n${dueReminder.time}`);
        return;
      }

      const nextReminder = getNextReminder(reminders);
      const rotationMessages = [
        getWelcomeMessage(profile, reminders, weatherMessage),
        weatherMessage,
        `TIME\n\n${getTimeLabel()}\n${getTodayLabel()}`,
        nextReminder
          ? `NEXT REMINDER\n\n${nextReminder.text}\n${nextReminder.time}`
          : "NO REMINDERS",
        "AI QUOTE\n\nSMALL STEPS COUNT",
        `NOTE\n\n${customNote}`,
      ];

      rotationIndex.current = (rotationIndex.current + 1) % rotationMessages.length;
      setBoardMessage(rotationMessages[rotationIndex.current] ?? INITIAL_MESSAGE);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [customNote, profile, reminders, weatherMessage]);

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-zinc-950 px-3 py-10 text-zinc-100 sm:px-6"
      onPointerDown={unlockAudio}
    >
      <div className="flex w-full max-w-6xl flex-col items-center gap-6">
        <SplitFlapBoard
          message={boardMessage}
          onCharactersChange={handleCharactersChange}
        />
        <div className="flex w-full max-w-3xl flex-col gap-4 px-3 sm:px-6">
          <form
            className="flex w-full flex-col gap-3 sm:flex-row"
            onSubmit={handleSubmit}
          >
            <label className="sr-only" htmlFor="question">
              Question
            </label>
            <input
              id="question"
              className="min-h-11 flex-1 rounded border border-zinc-700 bg-zinc-900 px-4 font-mono text-sm uppercase text-zinc-100 outline-none ring-white/20 placeholder:text-zinc-500 focus:border-zinc-500 focus:ring-2 disabled:cursor-not-allowed disabled:text-zinc-500"
              disabled={isLoading || isLocating || isCheckingSpotify}
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
              aria-label={isListening ? "Stop voice input" : "Start voice input"}
              aria-pressed={isListening}
              className="min-h-11 rounded border border-zinc-700 px-4 font-mono text-sm font-bold uppercase text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500"
              disabled={!isVoiceSupported || isLoading || isLocating || isCheckingSpotify}
              onClick={() => {
                unlockAudio();

                if (isListening) {
                  stopListening();
                  return;
                }

                startListening();
              }}
              type="button"
            >
              {isListening ? "Stop" : "Voice"}
            </button>
            <button
              aria-label="Use current location for weather"
              className="min-h-11 rounded border border-zinc-700 px-4 font-mono text-sm font-bold uppercase text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500"
              disabled={!isLocationSupported || isLoading || isLocating || isCheckingSpotify}
              onClick={handleUseLocation}
              type="button"
            >
              {isLocating ? "Locating" : "Location"}
            </button>
            <button
              aria-label="Show Spotify now playing"
              className="min-h-11 rounded border border-zinc-700 px-4 font-mono text-sm font-bold uppercase text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500"
              disabled={isLoading || isLocating || isCheckingSpotify}
              onClick={handleSpotifyNowPlaying}
              type="button"
            >
              {isCheckingSpotify ? "Spotify" : "Spotify"}
            </button>
            <button
              className="min-h-11 rounded border border-zinc-700 px-4 font-mono text-sm font-bold uppercase text-zinc-200 transition hover:border-zinc-500"
              onClick={handleReset}
              type="button"
            >
              Reset
            </button>
          </form>
          <div className="grid gap-3 rounded border border-zinc-800 bg-zinc-950/70 p-3 sm:grid-cols-[1fr_120px_1fr_auto]">
            <label className="flex flex-col gap-2 font-mono text-xs font-bold uppercase text-zinc-400" htmlFor="profile-name">
              Name
              <input
                id="profile-name"
                className="min-h-10 rounded border border-zinc-700 bg-zinc-900 px-3 text-sm uppercase text-zinc-100 outline-none focus:border-zinc-500"
                maxLength={18}
                onChange={(event) =>
                  handleProfileChange({ ...profile, name: event.target.value })
                }
                value={profile.name}
              />
            </label>
            <label className="flex flex-col gap-2 font-mono text-xs font-bold uppercase text-zinc-400" htmlFor="wake-time">
              Wake
              <input
                id="wake-time"
                className="min-h-10 rounded border border-zinc-700 bg-zinc-900 px-3 text-sm uppercase text-zinc-100 outline-none focus:border-zinc-500"
                onChange={(event) =>
                  handleProfileChange({ ...profile, wakeTime: event.target.value })
                }
                type="time"
                value={profile.wakeTime}
              />
            </label>
            <label className="flex flex-col gap-2 font-mono text-xs font-bold uppercase text-zinc-400" htmlFor="morning-note">
              Note
              <input
                id="morning-note"
                className="min-h-10 rounded border border-zinc-700 bg-zinc-900 px-3 text-sm uppercase text-zinc-100 outline-none focus:border-zinc-500"
                maxLength={44}
                onChange={(event) =>
                  handleProfileChange({ ...profile, note: event.target.value })
                }
                value={profile.note}
              />
            </label>
            <button
              className="min-h-10 self-end rounded border border-zinc-700 px-4 font-mono text-xs font-bold uppercase text-zinc-200 transition hover:border-zinc-500"
              onClick={handleShowWelcome}
              type="button"
            >
              Welcome
            </button>
          </div>
          <form
            className="grid gap-3 rounded border border-zinc-800 bg-zinc-950/70 p-3 sm:grid-cols-[1fr_120px_auto]"
            onSubmit={handleAddReminder}
          >
            <label className="flex flex-col gap-2 font-mono text-xs font-bold uppercase text-zinc-400" htmlFor="reminder-text">
              Reminder
              <input
                id="reminder-text"
                className="min-h-10 rounded border border-zinc-700 bg-zinc-900 px-3 text-sm uppercase text-zinc-100 outline-none focus:border-zinc-500"
                maxLength={44}
                onChange={(event) => setReminderText(event.target.value)}
                placeholder="DRINK WATER"
                value={reminderText}
              />
            </label>
            <label className="flex flex-col gap-2 font-mono text-xs font-bold uppercase text-zinc-400" htmlFor="reminder-time">
              Time
              <input
                id="reminder-time"
                className="min-h-10 rounded border border-zinc-700 bg-zinc-900 px-3 text-sm uppercase text-zinc-100 outline-none focus:border-zinc-500"
                onChange={(event) => setReminderTime(event.target.value)}
                type="time"
                value={reminderTime}
              />
            </label>
            <button
              className="min-h-10 self-end rounded border border-zinc-700 px-4 font-mono text-xs font-bold uppercase text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500"
              disabled={reminderText.trim().length === 0}
              type="submit"
            >
              Add
            </button>
            {reminders.length > 0 ? (
              <div className="flex flex-wrap gap-2 sm:col-span-3">
                {reminders.slice(0, 4).map((reminder) => (
                  <button
                    key={reminder.id}
                    className="rounded border border-zinc-800 px-3 py-2 font-mono text-xs uppercase text-zinc-400 transition hover:border-zinc-600"
                    onClick={() => handleRemoveReminder(reminder.id)}
                    type="button"
                  >
                    {reminder.time} {reminder.text}
                  </button>
                ))}
              </div>
            ) : null}
          </form>
          <div className="flex flex-col gap-3 rounded border border-zinc-800 bg-zinc-950/70 p-3 sm:flex-row sm:items-center">
            <button
              aria-pressed={isMuted}
              className="min-h-10 rounded border border-zinc-700 px-4 font-mono text-xs font-bold uppercase text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500"
              disabled={!isSupported}
              onClick={() => {
                unlockAudio();
                setIsMuted(!isMuted);
              }}
              type="button"
            >
              {isMuted ? "Unmute" : "Mute"}
            </button>
            <label
              className="flex flex-1 items-center gap-3 font-mono text-xs font-bold uppercase text-zinc-400"
              htmlFor="split-flap-volume"
            >
              Volume
              <input
                id="split-flap-volume"
                aria-label="Split-flap sound volume"
                className="w-full accent-zinc-100"
                disabled={!isSupported || isMuted}
                max="1"
                min="0"
                onChange={(event) => setVolume(Number(event.target.value))}
                step="0.01"
                type="range"
                value={volume}
              />
            </label>
          </div>
        </div>
      </div>
    </main>
  );
}
