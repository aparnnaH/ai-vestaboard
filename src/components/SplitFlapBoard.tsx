"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { BOARD_COLUMNS, formatBoardText } from "@/lib/formatBoardText";

export const FLAP_STEP_MS = 96;
export const FLAP_STAGGER_MS = 14;

const FLAP_CHARACTERS = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?'-";
const FLAP_STEPS = 7;

type SplitFlapBoardProps = {
  message: string;
  onCharactersChange?: (changedTileIndexes: number[], reducedMotion: boolean) => void;
};

type SplitFlapTileProps = {
  character: string;
  columnIndex: number;
  rowIndex: number;
};

function getFlapCharacter(targetCharacter: string, step: number): string {
  const targetIndex = FLAP_CHARACTERS.indexOf(targetCharacter);
  const startIndex = targetIndex >= 0 ? targetIndex : 0;

  return FLAP_CHARACTERS[(startIndex + step + 1) % FLAP_CHARACTERS.length] ?? " ";
}

function SplitFlapTile({ character, columnIndex, rowIndex }: SplitFlapTileProps) {
  const controls = useAnimationControls();
  const previousCharacter = useRef(character);
  const [displayCharacter, setDisplayCharacter] = useState(character);
  const shouldReduceMotion = useReducedMotion();
  const delay = (rowIndex * BOARD_COLUMNS + columnIndex) * FLAP_STAGGER_MS;

  useEffect(() => {
    if (previousCharacter.current === character) {
      return;
    }

    previousCharacter.current = character;

    const timers: Array<ReturnType<typeof setTimeout>> = [];

    const timeoutId = setTimeout(() => {
      if (shouldReduceMotion) {
        setDisplayCharacter(character);
        return;
      }

      for (let step = 0; step < FLAP_STEPS; step += 1) {
        timers.push(
          setTimeout(() => {
            setDisplayCharacter(
              step === FLAP_STEPS - 1 ? character : getFlapCharacter(character, step),
            );
            controls.start({
              opacity: [0.42, 1],
              rotateX: [-88, 0],
              y: [-4, 0],
              transition: { duration: 0.12, ease: "easeOut" },
            });
          }, step * FLAP_STEP_MS),
        );
      }
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [character, controls, delay, shouldReduceMotion]);

  return (
    <div className="flex aspect-[4/5] min-w-0 items-center justify-center overflow-hidden rounded bg-zinc-900 font-mono text-[clamp(0.5rem,3vw,1.7rem)] font-bold uppercase leading-none text-zinc-100 shadow-inner ring-1 ring-white/10">
      <motion.span
        aria-hidden={displayCharacter === " "}
        animate={controls}
        className="block [transform-style:preserve-3d]"
        initial={false}
      >
        {displayCharacter}
      </motion.span>
    </div>
  );
}

export function SplitFlapBoard({ message, onCharactersChange }: SplitFlapBoardProps) {
  const shouldReduceMotion = useReducedMotion();
  const previousCharacters = useRef<string[] | null>(null);
  const rows = useMemo(() => formatBoardText(message), [message]);
  const characters = useMemo(() => rows.flat(), [rows]);

  useEffect(() => {
    if (previousCharacters.current === null) {
      previousCharacters.current = characters;
      return;
    }

    const changedTileIndexes = characters.reduce<number[]>((indexes, character, index) => {
      if (previousCharacters.current?.[index] !== character) {
        indexes.push(index);
      }

      return indexes;
    }, []);

    previousCharacters.current = characters;

    if (changedTileIndexes.length > 0) {
      onCharactersChange?.(changedTileIndexes, shouldReduceMotion ?? false);
    }
  }, [characters, onCharactersChange, shouldReduceMotion]);

  return (
    <section
      aria-label="Digital split-flap board preview"
      className="w-full max-w-6xl px-3 sm:px-6"
    >
      <div
        className="grid gap-1.5 rounded-lg border border-zinc-700/70 bg-zinc-950 p-2 shadow-2xl shadow-black/40 sm:gap-2 sm:p-4"
        style={{ gridTemplateColumns: `repeat(${BOARD_COLUMNS}, minmax(0, 1fr))` }}
      >
        {rows.map((row, rowIndex) =>
          row.map((character, columnIndex) => (
            <SplitFlapTile
              key={`${rowIndex}-${columnIndex}`}
              character={character}
              columnIndex={columnIndex}
              rowIndex={rowIndex}
            />
          )),
        )}
      </div>
    </section>
  );
}
