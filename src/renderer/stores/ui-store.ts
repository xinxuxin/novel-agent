import { create } from "zustand";

import type { StudioMode } from "@contracts/preload";

interface UiState {
  commandPaletteOpen: boolean;
  studioMode: StudioMode;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setStudioMode: (studioMode: StudioMode) => void;
}

export const useUiStore = create<UiState>((set) => ({
  commandPaletteOpen: false,
  studioMode: "studio",
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  setStudioMode: (studioMode) => set({ studioMode })
}));
