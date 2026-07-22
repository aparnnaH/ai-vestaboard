"use client";

import { useCallback, useRef, useState } from "react";

type AppSpeechRecognitionResult = {
  transcript: string;
};

type AppSpeechRecognitionResultList = {
  length: number;
  [index: number]: {
    [index: number]: AppSpeechRecognitionResult;
  };
};

type AppSpeechRecognitionEvent = {
  results: AppSpeechRecognitionResultList;
};

type AppSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: AppSpeechRecognitionEvent) => void) | null;
  abort: () => void;
  start: () => void;
  stop: () => void;
};

type AppSpeechRecognitionConstructor = new () => AppSpeechRecognition;

type SpeechWindow = Window & {
  SpeechRecognition?: AppSpeechRecognitionConstructor;
  webkitSpeechRecognition?: AppSpeechRecognitionConstructor;
};

type UseVoiceInputOptions = {
  onTranscript: (transcript: string) => void;
};

type UseVoiceInputResult = {
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
};

function getSpeechRecognitionConstructor(): AppSpeechRecognitionConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as SpeechWindow;

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function useVoiceInput({ onTranscript }: UseVoiceInputOptions): UseVoiceInputResult {
  const recognitionRef = useRef<AppSpeechRecognition | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(() => getSpeechRecognitionConstructor() !== null);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor();

    if (SpeechRecognitionConstructor === null) {
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new SpeechRecognitionConstructor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript.trim();

      if (transcript) {
        onTranscript(transcript);
      }
    };

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [onTranscript]);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
  };
}
