import { create } from "zustand";

import type { StudioMode } from "@contracts/preload";
import type { StudioCommandId } from "@features/workflows/command-registry";

interface UiState {
  commandPaletteOpen: boolean;
  recentCommandIds: StudioCommandId[];
  studioMode: StudioMode;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  recordCommand: (commandId: StudioCommandId) => void;
  setStudioMode: (studioMode: StudioMode) => void;
}

export const useUiStore = create<UiState>((set) => ({
  commandPaletteOpen: false,
  recentCommandIds: [],
  studioMode: "studio",
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  recordCommand: (commandId) =>
    set((state) => ({
      recentCommandIds: [
        commandId,
        ...state.recentCommandIds.filter((id) => id !== commandId)
      ].slice(0, 8)
    })),
  setStudioMode: (studioMode) => set({ studioMode })
}));
