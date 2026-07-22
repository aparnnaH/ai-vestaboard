"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { BOARD_COLUMNS, formatBoardText } from "@/lib/formatBoardText";

type SplitFlapBoardProps = {
  message: string;
};

type SplitFlapTileProps = {
  character: string;
  columnIndex: number;
  rowIndex: number;
};

function SplitFlapTile({ character, columnIndex, rowIndex }: SplitFlapTileProps) {
  const controls = useAnimationControls();
  const previousCharacter = useRef(character);
  const shouldReduceMotion = useReducedMotion();
  const delay = (rowIndex * BOARD_COLUMNS + columnIndex) * 0.008;

  useEffect(() => {
    if (previousCharacter.current === character) {
      return;
    }

    previousCharacter.current = character;

    if (shouldReduceMotion) {
      return;
    }

    controls.start({
      opacity: [0.35, 1],
      rotateX: [-72, 0],
      y: [-3, 0],
      transition: { delay, duration: 0.22, ease: "easeOut" },
    });
  }, [character, controls, delay, shouldReduceMotion]);

  return (
    <div className="flex aspect-[4/5] min-w-0 items-center justify-center rounded bg-zinc-900 font-mono text-[clamp(0.5rem,3vw,1.7rem)] font-bold uppercase leading-none text-zinc-100 shadow-inner ring-1 ring-white/10">
      <motion.span
        aria-hidden={character === " "}
        animate={controls}
        className="block"
        initial={false}
      >
        {character}
      </motion.span>
    </div>
  );
}

export function SplitFlapBoard({ message }: SplitFlapBoardProps) {
  const rows = formatBoardText(message);

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
