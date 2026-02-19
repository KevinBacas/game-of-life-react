export type CellSet = Set<string>;

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function parseKey(key: string): [number, number] {
  const [r, c] = key.split(",");
  return [parseInt(r, 10), parseInt(c, 10)];
}

/**
 * Sparse Conway's Game of Life step.
 * Only iterates over alive cells and their neighbours — O(alive × 9).
 */
export function computeNextGeneration(alive: CellSet): CellSet {
  // Count neighbour occurrences for every candidate cell
  const neighbourCount = new Map<string, number>();

  for (const key of alive) {
    const [r, c] = parseKey(key);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const k = cellKey(r + dr, c + dc);
        neighbourCount.set(k, (neighbourCount.get(k) ?? 0) + 1);
      }
    }
  }

  const next: CellSet = new Set();

  for (const [key, count] of neighbourCount) {
    if (count === 3 || (count === 2 && alive.has(key))) {
      next.add(key);
    }
  }

  return next;
}
