"use client";

import { useCallback, useRef, useState } from "react";

const MUTED_STORAGE_KEY = "split-flap-muted";
const VOLUME_STORAGE_KEY = "split-flap-volume";
const DEFAULT_VOLUME = 0.18;
const MAX_BURSTS = 28;
const REDUCED_MOTION_MAX_BURSTS = 8;
const MIN_BURST_GAP_SECONDS = 0.045;

type AudioContextConstructor = typeof AudioContext;

type ScheduledNode = AudioBufferSourceNode | OscillatorNode;

type PlaySequenceOptions = {
  changedTileIndexes: readonly number[];
  stepMs: number;
  staggerMs: number;
  reducedMotion: boolean;
};

type UseSplitFlapAudioResult = {
  isMuted: boolean;
  isSupported: boolean;
  playSequence: (options: PlaySequenceOptions) => void;
  setIsMuted: (isMuted: boolean) => void;
  setVolume: (volume: number) => void;
  unlockAudio: () => void;
  volume: number;
};

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.AudioContext ?? null;
}

function getStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") {
    return fallback;
  }

  return window.localStorage.getItem(key) === "true";
}

function getStoredVolume(): number {
  if (typeof window === "undefined") {
    return DEFAULT_VOLUME;
  }

  const storedVolume = Number(window.localStorage.getItem(VOLUME_STORAGE_KEY));

  if (Number.isNaN(storedVolume)) {
    return DEFAULT_VOLUME;
  }

  return Math.min(1, Math.max(0, storedVolume));
}

function createNoiseBuffer(audioContext: AudioContext, duration: number): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = audioContext.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let index = 0; index < frameCount; index += 1) {
    channelData[index] = Math.random() * 2 - 1;
  }

  return buffer;
}

function getBurstIndexes(indexes: readonly number[], maxBursts: number): number[] {
  if (indexes.length <= maxBursts) {
    return [...indexes];
  }

  const stride = indexes.length / maxBursts;

  return Array.from({ length: maxBursts }, (_, index) => {
    return indexes[Math.floor(index * stride)] ?? indexes[0] ?? 0;
  });
}

export function useSplitFlapAudio(): UseSplitFlapAudioResult {
  const audioContextRef = useRef<AudioContext | null>(null);
  const scheduledNodesRef = useRef<ScheduledNode[]>([]);
  const [isMuted, setIsMutedState] = useState(() => {
    return getStoredBoolean(MUTED_STORAGE_KEY, false);
  });
  const [volume, setVolumeState] = useState(getStoredVolume);
  const [isSupported, setIsSupported] = useState(() => {
    return getAudioContextConstructor() !== null;
  });

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (audioContextRef.current !== null) {
      return audioContextRef.current;
    }

    const AudioContextConstructor = getAudioContextConstructor();

    if (AudioContextConstructor === null) {
      return null;
    }

    audioContextRef.current = new AudioContextConstructor();
    setIsSupported(true);

    return audioContextRef.current;
  }, []);

  const cancelSequence = useCallback(() => {
    for (const node of scheduledNodesRef.current) {
      try {
        node.stop();
      } catch {
        // Already stopped or not yet started.
      }
    }

    scheduledNodesRef.current = [];
  }, []);

  const unlockAudio = useCallback(() => {
    const audioContext = getAudioContext();

    if (audioContext?.state === "suspended") {
      void audioContext.resume();
    }
  }, [getAudioContext]);

  const setIsMuted = useCallback((nextIsMuted: boolean) => {
    setIsMutedState(nextIsMuted);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(MUTED_STORAGE_KEY, String(nextIsMuted));
    }
  }, []);

  const setVolume = useCallback((nextVolume: number) => {
    const normalizedVolume = Math.min(1, Math.max(0, nextVolume));
    setVolumeState(normalizedVolume);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(normalizedVolume));
    }
  }, []);

  const playBurst = useCallback(
    (audioContext: AudioContext, startTime: number, reducedMotion: boolean) => {
      const randomAmount = reducedMotion ? 0 : 1;
      const duration = (0.055 + Math.random() * 0.03 * randomAmount) * (reducedMotion ? 0.8 : 1);
      const burstVolume = volume * (reducedMotion ? 0.35 : 1) * (0.82 + Math.random() * 0.22 * randomAmount);
      const output = audioContext.createGain();
      output.gain.setValueAtTime(0.0001, startTime);
      output.gain.exponentialRampToValueAtTime(Math.max(0.0001, burstVolume), startTime + 0.006);
      output.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      output.connect(audioContext.destination);

      const noise = audioContext.createBufferSource();
      const noiseFilter = audioContext.createBiquadFilter();
      noise.buffer = createNoiseBuffer(audioContext, duration);
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(1100 + Math.random() * 220 * randomAmount, startTime);
      noiseFilter.Q.setValueAtTime(1.8, startTime);
      noise.connect(noiseFilter);
      noiseFilter.connect(output);
      noise.start(startTime);
      noise.stop(startTime + duration);

      const impact = audioContext.createOscillator();
      const impactGain = audioContext.createGain();
      impact.type = "triangle";
      impact.frequency.setValueAtTime(105 + Math.random() * 18 * randomAmount, startTime);
      impact.frequency.exponentialRampToValueAtTime(58, startTime + duration);
      impactGain.gain.setValueAtTime(0.0001, startTime);
      impactGain.gain.exponentialRampToValueAtTime(0.5, startTime + 0.004);
      impactGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      impact.connect(impactGain);
      impactGain.connect(output);
      impact.start(startTime);
      impact.stop(startTime + duration);

      const click = audioContext.createOscillator();
      const clickGain = audioContext.createGain();
      click.type = "square";
      click.frequency.setValueAtTime(2400 + Math.random() * 450 * randomAmount, startTime);
      clickGain.gain.setValueAtTime(0.0001, startTime);
      clickGain.gain.exponentialRampToValueAtTime(0.22, startTime + 0.002);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.018);
      click.connect(clickGain);
      clickGain.connect(output);
      click.start(startTime);
      click.stop(startTime + 0.02);

      scheduledNodesRef.current.push(noise, impact, click);
    },
    [volume],
  );

  const playSequence = useCallback(
    ({ changedTileIndexes, reducedMotion, staggerMs, stepMs }: PlaySequenceOptions) => {
      cancelSequence();

      if (isMuted || changedTileIndexes.length === 0 || volume <= 0) {
        return;
      }

      const audioContext = getAudioContext();

      if (audioContext === null) {
        return;
      }

      if (audioContext.state === "suspended") {
        void audioContext.resume();
      }

      const maxBursts = reducedMotion ? REDUCED_MOTION_MAX_BURSTS : MAX_BURSTS;
      const burstIndexes = getBurstIndexes(changedTileIndexes, maxBursts);
      const baseTime = audioContext.currentTime + 0.025;
      let previousStartTime = baseTime;

      for (const tileIndex of burstIndexes) {
        const visualTime = baseTime + (tileIndex * staggerMs) / 1000;
        const randomOffset = reducedMotion ? 0 : (Math.random() - 0.5) * 0.012;
        const startTime = Math.max(visualTime + randomOffset, previousStartTime + MIN_BURST_GAP_SECONDS);
        previousStartTime = startTime;

        for (let step = 0; step < (reducedMotion ? 1 : 2); step += 1) {
          playBurst(audioContext, startTime + (step * stepMs) / 1000, reducedMotion);
        }
      }
    },
    [cancelSequence, getAudioContext, isMuted, playBurst, volume],
  );

  return {
    isMuted,
    isSupported,
    playSequence,
    setIsMuted,
    setVolume,
    unlockAudio,
    volume,
  };
}
