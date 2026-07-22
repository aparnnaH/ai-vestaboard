export const BOARD_ROWS = 6;
export const BOARD_COLUMNS = 22;

const SUPPORTED_CHARACTER_PATTERN = /[^A-Z0-9 .,!?'"():;\-]/g;

function sanitizeLine(line: string): string {
  return line
    .toUpperCase()
    .replace(SUPPORTED_CHARACTER_PATTERN, " ")
    .replace(/[ \t]+/g, " ");
}

function padBoardRow(row: string): string[] {
  return Array.from({ length: BOARD_COLUMNS }, (_, index) => row[index] ?? " ");
}

export function formatBoardText(text: string): string[][] {
  const rows: string[] = [];

  for (const sourceLine of text.split(/\r?\n/)) {
    let line = sanitizeLine(sourceLine).trim();

    if (line.length === 0) {
      rows.push("");
      continue;
    }

    while (line.length > BOARD_COLUMNS) {
      const segment = line.slice(0, BOARD_COLUMNS + 1);
      const wrapIndex = segment.lastIndexOf(" ", BOARD_COLUMNS);

      if (wrapIndex > 0) {
        rows.push(line.slice(0, wrapIndex));
        line = line.slice(wrapIndex + 1).trimStart();
      } else {
        rows.push(line.slice(0, BOARD_COLUMNS));
        line = line.slice(BOARD_COLUMNS).trimStart();
      }
    }

    rows.push(line);
  }

  return Array.from({ length: BOARD_ROWS }, (_, rowIndex) => {
    return padBoardRow(rows[rowIndex] ?? "");
  });
}
