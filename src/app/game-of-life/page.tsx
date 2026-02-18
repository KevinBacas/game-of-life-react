"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const ROWS = 40;
const COLS = 40;
const CELL_SIZE = 16;

function createEmptyGrid(): boolean[][] {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(false));
}

function computeNextGeneration(grid: boolean[][]): boolean[][] {
  return grid.map((row, r) =>
    row.map((alive, c) => {
      let neighbours = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc]) {
            neighbours++;
          }
        }
      }
      if (alive) return neighbours === 2 || neighbours === 3;
      return neighbours === 3;
    }),
  );
}

const INTERVAL_MS = 150;

export default function GameOfLifePage() {
  const [grid, setGrid] = useState<boolean[][]>(createEmptyGrid);
  const [generation, setGeneration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const isPainting = useRef(false);
  const paintValue = useRef(true);

  // Stop painting when mouse is released anywhere
  useEffect(() => {
    const stopPainting = () => {
      isPainting.current = false;
    };
    document.addEventListener("mouseup", stopPainting);
    return () => document.removeEventListener("mouseup", stopPainting);
  }, []);

  const handleCellMouseDown = useCallback((row: number, col: number) => {
    isPainting.current = true;
    // The paint value is the opposite of the clicked cell's current state
    setGrid((prev) => {
      paintValue.current = !prev[row][col];
      const next = prev.map((r) => [...r]);
      next[row][col] = paintValue.current;
      return next;
    });
  }, []);

  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    if (!isPainting.current) return;
    setGrid((prev) => {
      if (prev[row][col] === paintValue.current) return prev;
      const next = prev.map((r) => [...r]);
      next[row][col] = paintValue.current;
      return next;
    });
  }, []);

  // Auto-play loop
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setGrid((prev) => computeNextGeneration(prev));
      setGeneration((g) => g + 1);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying]);

  const clearGrid = useCallback(() => {
    setIsPlaying(false);
    setGrid(createEmptyGrid());
    setGeneration(0);
  }, []);

  const stepForward = useCallback(() => {
    setGrid((prev) => computeNextGeneration(prev));
    setGeneration((g) => g + 1);
  }, []);

  const aliveCount = grid.flat().filter(Boolean).length;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 dark:bg-zinc-950 p-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Game of Life
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Click or drag to paint cells &mdash;{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {aliveCount}
          </span>{" "}
          alive &mdash; generation{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {generation}
          </span>
        </p>
      </div>

      {/* Grid */}
      <div
        className="border border-zinc-300 dark:border-zinc-700 select-none cursor-crosshair"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${ROWS}, ${CELL_SIZE}px)`,
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {grid.map((row, rowIdx) =>
          row.map((alive, colIdx) => (
            <div
              key={`${rowIdx}-${colIdx}`}
              onMouseDown={() => handleCellMouseDown(rowIdx, colIdx)}
              onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
              style={{ width: CELL_SIZE, height: CELL_SIZE }}
              className={[
                "border-[0.5px] border-zinc-200 dark:border-zinc-800",
                alive
                  ? "bg-zinc-900 dark:bg-zinc-100"
                  : "bg-white dark:bg-zinc-900",
              ].join(" ")}
            />
          )),
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setIsPlaying((p) => !p)}
          className="rounded-md px-4 py-2 text-sm font-medium transition-colors bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button
          onClick={stepForward}
          disabled={isPlaying}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next →
        </button>
        <button
          onClick={clearGrid}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Clear
        </button>
        <Link
          href="/"
          className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
        >
          ← Back
        </Link>
      </div>
    </div>
  );
}
