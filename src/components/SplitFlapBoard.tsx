import { BOARD_COLUMNS, formatBoardText } from "@/lib/formatBoardText";

const SAMPLE_MESSAGE = `ASK ME ANYTHING

YOUR AI ANSWER
WILL APPEAR HERE`;

export function SplitFlapBoard() {
  const rows = formatBoardText(SAMPLE_MESSAGE);

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
            <div
              key={`${rowIndex}-${columnIndex}`}
              className="flex aspect-[4/5] min-w-0 items-center justify-center rounded bg-zinc-900 font-mono text-[clamp(0.5rem,3vw,1.7rem)] font-bold uppercase leading-none text-zinc-100 shadow-inner ring-1 ring-white/10"
            >
              <span aria-hidden={character === " "}>{character}</span>
            </div>
          )),
        )}
      </div>
    </section>
  );
}
