"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cellKey, computeNextGeneration, type CellSet } from "./gameLogic";

const CELL_SIZE = 16; // px
const INTERVAL_MS = 150;
const BUFFER = 2; // extra cells rendered beyond visible edge

export default function GameOfLifePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });
  // panOffset: viewport-pixel position of world origin (0,0)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number } | null>(
    null,
  );

  const [aliveCells, setAliveCells] = useState<CellSet>(new Set());
  const [generation, setGeneration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Painting
  const isPainting = useRef(false);
  const paintValue = useRef(true); // true = draw alive, false = erase

  // rAF-batched wheel pan
  const pendingDelta = useRef({ x: 0, y: 0 });
  const rafScheduled = useRef(false);

  // ── Container sizing & initial pan centering ──────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
      // Centre world origin on first measurement
      setPanOffset((prev) =>
        prev === null
          ? { x: Math.round(width / 2), y: Math.round(height / 2) }
          : prev,
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Non-passive wheel listener for pan ───────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      pendingDelta.current.x -= e.deltaX;
      pendingDelta.current.y -= e.deltaY;
      if (!rafScheduled.current) {
        rafScheduled.current = true;
        requestAnimationFrame(() => {
          const dx = pendingDelta.current.x;
          const dy = pendingDelta.current.y;
          pendingDelta.current = { x: 0, y: 0 };
          rafScheduled.current = false;
          setPanOffset((prev) =>
            prev === null ? null : { x: prev.x + dx, y: prev.y + dy },
          );
        });
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── Global mouseup to stop painting ──────────────────────────────────────
  useEffect(() => {
    const stop = () => {
      isPainting.current = false;
    };
    document.addEventListener("mouseup", stop);
    return () => document.removeEventListener("mouseup", stop);
  }, []);

  // ── Auto-play loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setAliveCells((prev) => computeNextGeneration(prev));
      setGeneration((g) => g + 1);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying]);

  // ── World coordinate from viewport mouse position ─────────────────────────
  const worldCellFromEvent = useCallback(
    (e: React.MouseEvent) => {
      if (!panOffset || !containerRef.current) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const vx = e.clientX - rect.left;
      const vy = e.clientY - rect.top;
      const col = Math.floor((vx - panOffset.x) / CELL_SIZE);
      const row = Math.floor((vy - panOffset.y) / CELL_SIZE);
      return { row, col };
    },
    [panOffset],
  );

  // ── Paint handlers (on container, not per-cell) ───────────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const cell = worldCellFromEvent(e);
      if (!cell) return;
      const key = cellKey(cell.row, cell.col);
      isPainting.current = true;
      setAliveCells((prev) => {
        paintValue.current = !prev.has(key);
        const next = new Set(prev);
        if (paintValue.current) next.add(key);
        else next.delete(key);
        return next;
      });
    },
    [worldCellFromEvent],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPainting.current) return;
      const cell = worldCellFromEvent(e);
      if (!cell) return;
      const key = cellKey(cell.row, cell.col);
      setAliveCells((prev) => {
        if (prev.has(key) === paintValue.current) return prev;
        const next = new Set(prev);
        if (paintValue.current) next.add(key);
        else next.delete(key);
        return next;
      });
    },
    [worldCellFromEvent],
  );

  // ── Controls ──────────────────────────────────────────────────────────────
  const stepForward = useCallback(() => {
    setAliveCells((prev) => computeNextGeneration(prev));
    setGeneration((g) => g + 1);
  }, []);

  const clearGrid = useCallback(() => {
    setIsPlaying(false);
    setAliveCells(new Set());
    setGeneration(0);
  }, []);

  const resetView = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setPanOffset({ x: Math.round(width / 2), y: Math.round(height / 2) });
    }
  }, []);

  // ── Virtual grid derivation ───────────────────────────────────────────────
  const pan = panOffset ?? { x: containerSize.w / 2, y: containerSize.h / 2 };

  const startCol = Math.floor(-pan.x / CELL_SIZE) - BUFFER;
  const startRow = Math.floor(-pan.y / CELL_SIZE) - BUFFER;
  const visibleCols = Math.ceil(containerSize.w / CELL_SIZE) + BUFFER * 2 + 1;
  const visibleRows = Math.ceil(containerSize.h / CELL_SIZE) + BUFFER * 2 + 1;

  // Top-left pixel of the rendered grid block, in viewport space
  const gridLeft = pan.x + startCol * CELL_SIZE;
  const gridTop = pan.y + startRow * CELL_SIZE;

  // Build the visible cell list
  const cells: React.ReactNode[] = [];
  for (let r = startRow; r < startRow + visibleRows; r++) {
    for (let c = startCol; c < startCol + visibleCols; c++) {
      const alive = aliveCells.has(cellKey(r, c));
      cells.push(
        <div
          key={`${r},${c}`}
          style={{ width: CELL_SIZE, height: CELL_SIZE }}
          className={[
            "border-[0.5px] border-zinc-200 dark:border-zinc-800",
            alive
              ? "bg-zinc-900 dark:bg-zinc-100"
              : "bg-white dark:bg-zinc-900",
          ].join(" ")}
        />,
      );
    }
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* HUD ---------------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
        <h1 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Game of Life
        </h1>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {aliveCells.size}
          </span>{" "}
          alive &mdash; gen{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {generation}
          </span>
          <span className="hidden sm:inline text-zinc-400 dark:text-zinc-600">
            {" "}
            &mdash; scroll to pan &middot; click/drag to paint
          </span>
        </p>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="rounded-md px-3 py-1.5 text-sm font-medium transition-colors bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={stepForward}
            disabled={isPlaying}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
          <button
            onClick={resetView}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Re-center view on origin"
          >
            ⌖ Center
          </button>
          <button
            onClick={clearGrid}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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

      {/* Viewport ----------------------------------------------------------- */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden select-none cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* Origin crosshair */}
        {panOffset && (
          <>
            <div
              className="absolute pointer-events-none bg-zinc-300 dark:bg-zinc-700 opacity-60"
              style={{ left: pan.x - 0.5, top: 0, width: 1, height: "100%" }}
            />
            <div
              className="absolute pointer-events-none bg-zinc-300 dark:bg-zinc-700 opacity-60"
              style={{ top: pan.y - 0.5, left: 0, height: 1, width: "100%" }}
            />
          </>
        )}

        {/* Virtual grid block */}
        <div
          className="absolute"
          style={{
            left: gridLeft,
            top: gridTop,
            display: "grid",
            gridTemplateColumns: `repeat(${visibleCols}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${visibleRows}, ${CELL_SIZE}px)`,
          }}
        >
          {cells}
        </div>
      </div>
    </div>
  );
}
