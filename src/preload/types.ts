import type { WenForgeApi } from "@contracts/preload";

declare global {
  interface Window {
    wenforge: WenForgeApi;
  }
}

export {};
