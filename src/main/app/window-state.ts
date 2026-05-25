import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export const DEFAULT_WINDOW_BOUNDS: WindowBounds = {
  width: 1180,
  height: 760
};

export const POPOVER_WINDOW_BOUNDS: WindowBounds = {
  width: 460,
  height: 640
};

const MIN_WINDOW_WIDTH = 860;
const MIN_WINDOW_HEIGHT = 560;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function normalizeWindowBounds(value: Partial<WindowBounds> | undefined): WindowBounds {
  const width = Math.max(
    isFiniteNumber(value?.width) ? Math.round(value.width) : DEFAULT_WINDOW_BOUNDS.width,
    MIN_WINDOW_WIDTH
  );
  const height = Math.max(
    isFiniteNumber(value?.height) ? Math.round(value.height) : DEFAULT_WINDOW_BOUNDS.height,
    MIN_WINDOW_HEIGHT
  );
  const normalized: WindowBounds = { width, height };

  if (isFiniteNumber(value?.x)) {
    normalized.x = Math.round(value.x);
  }

  if (isFiniteNumber(value?.y)) {
    normalized.y = Math.round(value.y);
  }

  return normalized;
}

export function readWindowBounds(filePath: string): WindowBounds {
  if (!existsSync(filePath)) {
    return DEFAULT_WINDOW_BOUNDS;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as Partial<WindowBounds>;
    return normalizeWindowBounds(parsed);
  } catch {
    return DEFAULT_WINDOW_BOUNDS;
  }
}

export function writeWindowBounds(filePath: string, bounds: WindowBounds): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(normalizeWindowBounds(bounds), null, 2));
}
